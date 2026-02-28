import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { requireSessionUser } from "@/lib/server/authz";
import { sha256 } from "@/lib/server/security";

function random6Digits() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST() {
  const sb = supabaseAdmin();
  const u = await requireSessionUser({ rolling: false });

  // leer user real
  const { data: user, error: uErr } = await sb
    .from("users")
    .select("id,account_status,deleted_at")
    .eq("id", u.id)
    .maybeSingle();

  if (uErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  if (!user || user.deleted_at) return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  if (user.account_status === "active") {
    return NextResponse.json({ ok: true, status: "ALREADY_ACTIVE" }, { status: 200 });
  }

  const code = random6Digits();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // upsert manual verification row
  const { data: existing, error: eErr } = await sb
    .from("phone_verifications")
    .select("id,method")
    .eq("user_id", u.id)
    .eq("method", "manual")
    .maybeSingle();

  if (eErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });

  if (!existing) {
    const { error: insErr } = await sb.from("phone_verifications").insert({
      user_id: u.id,
      phone_e164: "", // no se usa en manual; se deja vacío V1 (si prefieres, guarda el real)
      method: "manual",
      status: "pending",
      manual_code_hash: sha256(code),
      manual_code_expires_at: expiresAt.toISOString(),
      manual_attempts: 0,
      updated_at: now.toISOString(),
    });
    if (insErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  } else {
    const { error: upErr } = await sb
      .from("phone_verifications")
      .update({
        status: "pending",
        manual_code_hash: sha256(code),
        manual_code_expires_at: expiresAt.toISOString(),
        manual_attempts: 0,
        updated_at: now.toISOString(),
      })
      .eq("id", existing.id);
    if (upErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  }

  // mover cuenta a pending_manual_validation (si no lo está ya)
  await sb
    .from("users")
    .update({
      account_status: "pending_manual_validation",
      status_changed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", u.id);

  // V1: el código NO se regresa al usuario.
  // El admin lo verá/mandará por WhatsApp/Email desde panel (más adelante).
  return NextResponse.json({ ok: true }, { status: 200 });
}
