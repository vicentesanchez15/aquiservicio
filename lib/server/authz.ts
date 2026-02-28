import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { sha256 } from "@/lib/server/security";

export type SessionUser = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "user" | "admin" | "helper";
  account_status:
    | "active"
    | "limited"
    | "suspended"
    | "banned"
    | "pending_deletion"
    | "under_review"
    | "shadowbanned"
    | "pending_manual_validation"
    | "manual_expired"
    | "inactive_temp";
  premium_expires_at: string | null;
  municipality_id: string;
};

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function getSessionUserInternal(opts?: { rolling?: boolean }): Promise<SessionUser> {
  const sb = supabaseAdmin();
  const token = cookies().get("session_token")?.value;
  if (!token) throw new HttpError(401, "NO_SESSION");

  const tokenHash = sha256(token);

  const { data: sess, error: sErr } = await sb
    .from("user_sessions")
    .select("id,user_id,expires_at,revoked_at")
    .eq("session_token_hash", tokenHash)
    .maybeSingle();

  if (sErr || !sess) throw new HttpError(401, "SESSION_NOT_FOUND");
  if (sess.revoked_at) throw new HttpError(401, "SESSION_REVOKED");
  if (new Date(sess.expires_at) < new Date()) throw new HttpError(401, "SESSION_EXPIRED");

  const { data: user, error: uErr } = await sb
    .from("users")
    .select("id,username,first_name,last_name,role,account_status,premium_expires_at,municipality_id")
    .eq("id", sess.user_id)
    .single();

  if (uErr || !user) throw new HttpError(500, "DB_ERROR");

  // Premium auto-expire (V1 sin cron)
  if (user.premium_expires_at && new Date(user.premium_expires_at) < new Date()) {
    await sb
      .from("users")
      .update({ premium_expires_at: null, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    user.premium_expires_at = null;
  }

  // Rolling session opcional (solo donde convenga)
  if (opts?.rolling) {
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await sb
      .from("user_sessions")
      .update({
        last_seen_at: now.toISOString(),
        expires_at: newExpiresAt.toISOString(),
      })
      .eq("id", sess.id);
  }

  return user as SessionUser;
}

/**
 * Lectura privada: requiere sesión válida.
 * Bloquea únicamente banned/suspended.
 */
export async function requireSessionUser(opts?: { rolling?: boolean }) {
  const user = await getSessionUserInternal(opts);

  if (user.account_status === "banned" || user.account_status === "suspended") {
    throw new HttpError(403, "ACCOUNT_BLOCKED");
  }

  return user;
}

/**
 * Acciones: requiere sesión válida + status active.
 */
export async function requireActiveUser(opts?: { rolling?: boolean }) {
  const user = await getSessionUserInternal(opts);

  if (user.account_status === "banned" || user.account_status === "suspended") {
    throw new HttpError(403, "ACCOUNT_BLOCKED");
  }

  if (user.account_status !== "active") {
    // aquí caen limited, under_review, shadowbanned, pending_manual_validation, etc.
    throw new HttpError(403, "ACCOUNT_NOT_ACTIVE");
  }

  return user;
}
