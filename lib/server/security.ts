import crypto from "crypto";

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashPassword(password: string) {
  // V1 práctico: scrypt (mejor que sha), sin libs externas
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [kind, saltHex, hashHex] = stored.split(":");
  if (kind !== "scrypt") return false;
  const salt = Buffer.from(saltHex, "hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(derived, Buffer.from(hashHex, "hex"));
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function normalizeE164MX(input: string) {
  // V1: México solamente. Acepta 10 dígitos o +52...
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+52${digits}`;
  if (digits.startsWith("52") && digits.length === 12) return `+${digits}`;
  if (input.startsWith("+") && /^\+[1-9]\d{7,14}$/.test(input)) return input;
  throw new Error("PHONE_INVALID");
}

export function deviceFingerprintHash(opts: {
  userAgent: string;
  acceptLanguage: string;
  ip: string;
  salt: string;
}) {
  // IP /24 simple (para IPv4)
  const ip24 = opts.ip.includes(".")
    ? opts.ip.split(".").slice(0, 3).join(".")
    : opts.ip; // si IPv6, lo dejas tal cual en V1
  return sha256(`${opts.userAgent}|${opts.acceptLanguage}|${ip24}|${opts.salt}`);
}
