import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { hashPassword, normalizeE164MX } from "@/lib/server/security";
import { getClientIp, getUA } from "@/lib/server/http";

function requireAdminPanelKey(req: Request) {
  const got = req.headers.get("x-admin-panel-key") || "";
  const expected = process.env.ADMIN_PANEL_KEY || "";
  return Boolean(expected) && got === expected;
}

export async function POST(req: Request) {
  if (!requireAdminPanelKey(req)) {
    return NextResponse.json({ ok: false, error: "ADMIN_KEY_INVALID" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const ip = await  getClientIp();
  const { ua } = await getUA();

  const body = await req.json().catch(() => ({}));
  const { phone, password, first_name, last_name, whatsapp, email } = body;

  if (!phone || !password || !first_name || !last_name || !whatsapp) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  // 1) system_settings singleton
  const { data: settings, error: sErr } = await sb
    .from("system_settings")
    .select("id,admin_bootstrap_done")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (sErr || !settings) {
    return NextResponse.json({ ok: false, error: "SYSTEM_SETTINGS_MISSING" }, { status: 500 });
  }

  if (settings.admin_bootstrap_done) {
    return NextResponse.json({ ok: false, error: "BOOTSTRAP_ALREADY_DONE" }, { status: 409 });
  }

  // 2) Normalize
  let phoneE164: string;
  let whatsappE164: string;
  try {
    phoneE164 = normalizeE164MX(phone);
    whatsappE164 = normalizeE164MX(whatsapp);
  } catch {
    return NextResponse.json({ ok: false, error: "PHONE_INVALID" }, { status: 400 });
  }

  // 3) Get SYSTEM municipality & colony (ya los creaste)
  const { data: sysMuni, error: mErr } = await sb
    .from("municipalities")
    .select("id,status,allow_registration,deleted_at")
    .eq("name", "SYSTEM")
    .maybeSingle();

  if (mErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  if (!sysMuni || sysMuni.deleted_at) {
    return NextResponse.json({ ok: false, error: "SYSTEM_MUNI_MISSING" }, { status: 500 });
  }

  const { data: sysCol, error: cErr } = await sb
    .from("colonies")
    .select("id,is_active,deleted_at,municipality_id")
    .eq("municipality_id", sysMuni.id)
    .eq("name", "SYSTEM")
    .maybeSingle();

  if (cErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  if (!sysCol || sysCol.deleted_at) {
    return NextResponse.json({ ok: false, error: "SYSTEM_COLONY_MISSING" }, { status: 500 });
  }

  // 4) Create admin user
  const password_hash = hashPassword(password);

  const { data: adminUser, error: uInsErr } = await sb
    .from("users")
    .insert({
      phone_e164: phoneE164,
      username: `admin-${Math.random().toString(16).slice(2, 6)}`,
      first_name,
      last_name,
      municipality_id: sysMuni.id,
      colony_id: sysCol.id,
      whatsapp_e164: whatsappE164,
      email: email || null,
      password_hash,
      role: "admin",
      account_status: "active",
      accepted_rules_at: new Date().toISOString(),
    })
    .select("id,username,role,account_status")
    .single();

  if (uInsErr || !adminUser) {
    return NextResponse.json({ ok: false, error: "ADMIN_CREATE_FAILED" }, { status: 400 });
  }

  // 5) Mark bootstrap done
  const now = new Date().toISOString();
  const { error: upErr } = await sb
    .from("system_settings")
    .update({
      admin_bootstrap_done: true,
      admin_bootstrap_done_at: now,
      admin_bootstrap_admin_user_id: adminUser.id,
      updated_at: now,
    })
    .eq("id", settings.id);

  if (upErr) {
    return NextResponse.json({ ok: false, error: "BOOTSTRAP_FLAG_UPDATE_FAILED" }, { status: 500 });
  }

  // 6) Audit
  await sb.from("admin_audit_logs").insert({
    admin_user_id: adminUser.id,
    action: "bootstrap_admin_created",
    entity_type: "users",
    entity_id: adminUser.id,
    before_json: null,
    after_json: { phone_e164: phoneE164, role: "admin" },
    ip,
    user_agent: ua,
  });

  return NextResponse.json({ ok: true, admin: adminUser }, { status: 200 });
}
