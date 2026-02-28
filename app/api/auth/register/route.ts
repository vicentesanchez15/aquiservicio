import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { hitRateLimit } from "@/lib/server/rateLimit";
import { getClientIp, getUA } from "@/lib/server/http";
import {
  hashPassword,
  normalizeE164MX,
  deviceFingerprintHash,
  randomToken,
  sha256,
} from "@/lib/server/security";

export async function POST(req: Request) {
  const sb = supabaseAdmin();
  const ip = await getClientIp();
  const { ua, lang } = await getUA();

  const body = await req.json().catch(() => ({}));
  const {
    phone,
    password,
    first_name,
    last_name,
    municipality_id,
    colony_id,
    whatsapp,
    email,
    accepted_rules,
  } = body;

  if (
    !phone ||
    !password ||
    !first_name ||
    !last_name ||
    !municipality_id ||
    !colony_id ||
    !whatsapp ||
    accepted_rules !== true
  ) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  let phoneE164: string;
  let whatsappE164: string;
  try {
    phoneE164 = normalizeE164MX(phone);
    whatsappE164 = normalizeE164MX(whatsapp);
  } catch {
    return NextResponse.json({ ok: false, error: "PHONE_INVALID" }, { status: 400 });
  }

  // Rate limits
  const fp = deviceFingerprintHash({
    userAgent: ua,
    acceptLanguage: lang,
    ip,
    salt: process.env.RATE_LIMIT_SECRET!,
  });

  const r1 = await hitRateLimit({
    key: `ip:${ip}:register`,
    windowSeconds: 86400,
    maxHits: 2,
  });
  if (!r1.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMIT_REGISTER_IP" }, { status: 429 });
  }

  const r2 = await hitRateLimit({
    key: `device:${fp}:register`,
    windowSeconds: 86400,
    maxHits: 1,
  });
  if (!r2.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMIT_REGISTER_DEVICE" }, { status: 429 });
  }

  // Check municipality allow_registration + status
  const { data: muni, error: muniErr } = await sb
    .from("municipalities")
    .select("id,status,allow_registration,deleted_at")
    .eq("id", municipality_id)
    .maybeSingle();

  if (muniErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });

  if (!muni || muni.deleted_at || muni.status !== "active" || muni.allow_registration !== true) {
    return NextResponse.json({ ok: false, error: "MUNICIPALITY_NOT_ALLOWED" }, { status: 400 });
  }

  // Colony belongs to municipality + active
  const { data: col, error: colErr } = await sb
    .from("colonies")
    .select("id,municipality_id,is_active,deleted_at")
    .eq("id", colony_id)
    .maybeSingle();

  if (colErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });

  if (!col || col.deleted_at || col.is_active !== true || col.municipality_id !== municipality_id) {
    return NextResponse.json({ ok: false, error: "COLONY_NOT_ALLOWED" }, { status: 400 });
  }

  // Username autogenerado (simple)
  const base =
    `${first_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16) || "user";
  const suffix = Math.random().toString(16).slice(2, 6);
  const username = `${base}-${suffix}`;

  const password_hash = hashPassword(password);

  // Create user
  const { data: user, error: insErr } = await sb
    .from("users")
    .insert({
      phone_e164: phoneE164,
      username,
      first_name,
      last_name,
      municipality_id,
      colony_id,
      whatsapp_e164: whatsappE164,
      email: email || null,
      password_hash,
      accepted_rules_at: new Date().toISOString(),
      // Por defecto pending_manual_validation; Twilio flow lo cambia
      account_status: "pending_manual_validation",
    })
    .select("id,username,account_status")
    .single();

  if (insErr || !user) {
    return NextResponse.json({ ok: false, error: "USER_CREATE_FAILED" }, { status: 400 });
  }

  // ✅ Crear sesión inmediatamente (igual que login)
  const sessionToken = randomToken(32);
  const sessionHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();

  const { error: sessErr } = await sb.from("user_sessions").insert({
    user_id: user.id,
    session_token_hash: sessionHash,
    expires_at: expiresAt,
    ip,
    user_agent: ua,
  });

  if (sessErr) {
    return NextResponse.json({ ok: false, error: "SESSION_CREATE_FAILED" }, { status: 500 });
  }

  cookies().set("session_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  // Nota: sigue en pending_manual_validation hasta que Verify lo pase a active.
  return NextResponse.json({ ok: true, user }, { status: 200 });
}
