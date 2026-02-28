import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { requireSessionUser } from "@/lib/server/authz";
import { sha256 } from "@/lib/server/security";

export async function POST(req: Request) {
  const sb = supabaseAdmin();
  const u = await requireSessionUser({ rolling: false });

  const body = await req.json().catch(() => ({}));
  const { code } = body;

  if (!code) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { data: pv, error: pvErr } = await sb
    .from("phone_verifications")
    .select("id,status,manual_code_hash,manual_code_expires_at,manual_attempts")
    .eq("user_id", u.id)
    .eq("method", "manual")
    .maybeSingle();

  if (pvErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  if (!pv || !pv.manual_code_hash || !pv.manual_code_expires_at) {
    return NextResponse.json({ ok: false, error: "MANUAL_NOT_REQUESTED" }, { status: 400 });
  }

  const attempts = Number(pv.manual_attempts ?? 0);
  if (attempts >= 5) {
    return NextResponse.json({ ok: false, error: "CODE_ATTEMPTS_EXCEEDED" }, { status: 429 });
  }

  const exp = new Date(pv.manual_code_expires_at);
  if (exp < new Date()) {
    await sb.from("phone_verifications").update({ status: "expired" }).eq("id", pv.id);
    return NextResponse.json({ ok: false, error: "MANUAL_CODE_EXPIRED" }, { status: 410 });
  }

  const ok = sha256(String(code)) === pv.manual_code_hash;
  const now = new Date().toISOString();

  if (!ok) {
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

    return NextResponse.json({ ok: false, error: "CODE_INVALID" }, { status: 401 });
  }

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
    .eq("id", u.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
