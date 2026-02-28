import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { normalizeE164MX } from "@/lib/server/security";
import { getClientIp } from "@/lib/server/http";
import { hitRateLimit } from "@/lib/server/rateLimit";
import { requireSessionUser } from "@/lib/server/authz";
import twilio from "twilio";

export async function POST() {
  const sb = supabaseAdmin();
  const ip = await getClientIp();

  // ✅ Seguridad: NO aceptar user_id del cliente. Tomar usuario desde cookie.
  const sessionUser = await requireSessionUser({ rolling: false });
  const userId = sessionUser.id;

  // Rate limit IP (tu regla)
  const rlIp = await hitRateLimit({
    key: `ip:${ip}:sms`,
    windowSeconds: 86400,
    maxHits: 1,
  });
  if (!rlIp.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMIT_SMS_IP" },
      { status: 429 }
    );
  }

  // ✅ Rate limit por cuenta (blindaje “1 SMS por cuenta”)
  const rlUser = await hitRateLimit({
    key: `user:${userId}:sms`,
    windowSeconds: 86400,
    maxHits: 1,
  });
  if (!rlUser.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMIT_SMS_USER" },
      { status: 429 }
    );
  }

  // Leer user real (para phone_e164 + status)
  const { data: user, error: uErr } = await sb
    .from("users")
    .select("id,phone_e164,account_status,deleted_at")
    .eq("id", userId)
    .maybeSingle();

  if (uErr) {
    return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  }
  if (!user || user.deleted_at) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Si ya está active, no tiene sentido enviar SMS
  if (user.account_status === "active") {
    return NextResponse.json(
      { ok: true, status: "ALREADY_ACTIVE" },
      { status: 200 }
    );
  }

  let phoneE164: string;
  try {
    // user.phone_e164 ya debería estar normalizado; igual lo revalidamos.
    phoneE164 = normalizeE164MX(user.phone_e164);
  } catch {
    return NextResponse.json(
      { ok: false, error: "PHONE_INVALID" },
      { status: 400 }
    );
  }

  // 1 SMS por cuenta (persistente): si ya se envió antes, bloquear
  const { data: pvExisting, error: pvErr } = await sb
    .from("phone_verifications")
    .select("id,method,status,sms_sent_at,manual_attempts")
    .eq("user_id", user.id)
    .eq("method", "twilio_sms")
    .maybeSingle();

  if (pvErr) {
    return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  }

  if (pvExisting?.sms_sent_at) {
    return NextResponse.json(
      { ok: false, error: "SMS_ALREADY_SENT" },
      { status: 409 }
    );
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  // Twilio Verify start
  let sid: string;
  try {
    const r = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phoneE164, channel: "sms" });

    sid = r.sid;
  } catch {
    return NextResponse.json(
      { ok: false, error: "TWILIO_START_FAILED" },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();

  if (!pvExisting) {
    const { error: insErr } = await sb.from("phone_verifications").insert({
      user_id: user.id,
      phone_e164: phoneE164,
      method: "twilio_sms",
      status: "pending",
      twilio_sid: sid,
      sms_sent_at: now,
      // Nota V1: manual_attempts se usa como contador de intentos del código (máx 5)
      manual_attempts: 0,
      updated_at: now,
    });

    if (insErr) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR" },
        { status: 500 }
      );
    }
  } else {
    const { error: upErr } = await sb
      .from("phone_verifications")
      .update({
        status: "pending",
        twilio_sid: sid,
        sms_sent_at: now,
        updated_at: now,
      })
      .eq("id", pvExisting.id);

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
