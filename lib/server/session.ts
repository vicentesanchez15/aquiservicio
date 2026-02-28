import crypto from "crypto";

const COOKIE_NAME = "as_session";

export function getCookieName() {
  return COOKIE_NAME;
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string) {
  const secret = process.env.RATE_LIMIT_SECRET!;
  if (!secret) throw new Error("Missing RATE_LIMIT_SECRET");
  return crypto.createHmac("sha256", secret).update(rawToken).digest("hex");
}
