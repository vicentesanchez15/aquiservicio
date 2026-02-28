import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { normalizeE164MX } from "@/lib/server/security";
import { requireSessionUser } from "@/lib/server/authz";
import twilio from "twilio";

export async function POST(req: Request) {
  const sb = supabaseAdmin();

  // ✅ Seguridad: usuario desde cookie (NO user_id del cliente)
  const sessionUser = await requireSessionUser({ rolling: false });
  const userId = sessionUser.id;

  const body = await req.json().catch(() => ({}));
  const { code } = body;

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS" },
      { status: 400 }
    );
  }

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

  if (user.account_status === "active") {
    return NextResponse.json(
      { ok: true, status: "ALREADY_ACTIVE" },
      { status: 200 }
    );
  }

  let phoneE164: string;
  try {
    phoneE164 = normalizeE164MX(user.phone_e164);
  } catch {
    return NextResponse.json(
      { ok: false, error: "PHONE_INVALID" },
      { status: 400 }
    );
  }

  const { data: pv, error: pvErr } = await sb
    .from("phone_verifications")
    .select("id,status,method,sms_sent_at,manual_attempts")
    .eq("user_id", user.id)
    .eq("method", "twilio_sms")
    .maybeSingle();

  if (pvErr) {
    return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  }
  if (!pv || !pv.sms_sent_at) {
    return NextResponse.json(
      { ok: false, error: "SMS_NOT_SENT" },
      { status: 400 }
    );
  }

  const attempts = Number(pv.manual_attempts ?? 0);
  if (attempts >= 5) {
    return NextResponse.json(
      { ok: false, error: "CODE_ATTEMPTS_EXCEEDED" },
      { status: 429 }
    );
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  let approved = false;
  try {
    const r = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phoneE164, code: String(code) });

    approved = r.status === "approved";
  } catch {
    // cuenta intento aunque Twilio falle (anti abuso)
    const now = new Date().toISOString();
    await sb
      .from("phone_verifications")
      .update({
        manual_attempts: attempts + 1,
        updated_at: now,
      })
      .eq("id", pv.id);

    return NextResponse.json(
      { ok: false, error: "TWILIO_CHECK_FAILED" },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();

  if (!approved) {
    const nextAttempts = attempts + 1;

    await sb
      .from("phone_verifications")
      .update({
        manual_attempts: nextAttempts,
        status: nextAttempts >= 5 ? "failed" : "pending",
        updated_at: now,
        failed_reason: nextAttempts >= 5 ? "max_attempts" : null,
      })
      .eq("id", pv.id);

    return NextResponse.json(
      { ok: false, error: "CODE_INVALID" },
      { status: 401 }
    );
  }

  // aprobado
  await sb
    .from("phone_verifications")
    .update({
      status: "verified",
      verified_at: now,
      updated_at: now,
    })
    .eq("id", pv.id);

  await sb
    .from("users")
    .update({
      account_status: "active",
      status_changed_at: now,
      updated_at: now,
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
