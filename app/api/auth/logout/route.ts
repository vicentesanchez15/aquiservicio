import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { sha256 } from "@/lib/server/security";

export async function POST() {
  const sb = supabaseAdmin();
  const token = cookies().get("session_token")?.value;

  if (token) {
    const tokenHash = sha256(token);
    await sb
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "logout" })
      .eq("session_token_hash", tokenHash);
  }

  cookies().set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
