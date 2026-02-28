import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { hitRateLimit } from "@/lib/server/rateLimit";
import { getClientIp, getUA } from "@/lib/server/http";
import { normalizeE164MX, randomToken, sha256, verifyPassword } from "@/lib/server/security";

function lockMinutes(level: number) {
  // 0->15m, 1->60m, 2->360m, 3->1440m
  if (level <= 0) return 15;
  if (level === 1) return 60;
  if (level === 2) return 360;
  return 1440;
}

export async function POST(req: Request) {
  const sb = supabaseAdmin();
  const ip = await getClientIp();
  const { ua } = await getUA();

  const body = await req.json().catch(() => ({}));
  const { phone, password } = body;

  if (!phone || !password) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  let phoneE164: string;
  try {
    phoneE164 = normalizeE164MX(phone);
  } catch {
    return NextResponse.json({ ok: false, error: "PHONE_INVALID" }, { status: 400 });
  }

  // Rate limit login
  const rl1 = await hitRateLimit({ key: `ip:${ip}:login`, windowSeconds: 900, maxHits: 30 });
  if (!rl1.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMIT_LOGIN_IP" }, { status: 429 });

  const rl2 = await hitRateLimit({ key: `phone:${phoneE164}:login`, windowSeconds: 900, maxHits: 10 });
  if (!rl2.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMIT_LOGIN_PHONE" }, { status: 429 });

  const { data: user, error } = await sb
    .from("users")
    .select("id,password_hash,account_status,locked_until,lock_level,failed_login_count,premium_expires_at,role")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  // hard blocks
  if (["banned","suspended"].includes(user.account_status)) {
    return NextResponse.json({ ok: false, error: "ACCOUNT_BLOCKED" }, { status: 403 });
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return NextResponse.json({ ok: false, error: "ACCOUNT_LOCKED" }, { status: 423 });
  }

  const ok = verifyPassword(password, user.password_hash);
  if (!ok) {
    const nextFailed = (user.failed_login_count || 0) + 1;

    // every 5 bad attempts -> lock escalates
    let lockLevel = user.lock_level || 0;
    let lockedUntil = null as string | null;

    if (nextFailed % 5 === 0) {
      const minutes = lockMinutes(lockLevel);
      lockedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
      lockLevel = Math.min(lockLevel + 1, 3);
    }

    await sb
      .from("users")
      .update({
        failed_login_count: nextFailed,
        lock_level: lockLevel,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  // reset counters on success
  await sb
    .from("users")
    .update({
      failed_login_count: 0,
      lock_level: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  // create session
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

  return NextResponse.json({ ok: true }, { status: 200 });
}
