const crypto = require("crypto");

const COOKIE_NAME = "aq_session";

function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function fromB64url(s) {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}
function hmac(data) {
  return crypto.createHmac("sha256", process.env.PANELKEY).update(data).digest();
}

function signSession(payloadObj) {
  const payload = b64url(JSON.stringify(payloadObj));
  const sig = b64url(hmac(payload));
  return `${payload}.${sig}`;
}

function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = b64url(hmac(payload));
  // comparación constante
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const obj = JSON.parse(fromB64url(payload).toString("utf8"));
    if (!obj || !obj.exp || Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  raw.split(";").forEach(p => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setCookie(res, token, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`
  ];
  // En producción usa Secure
  parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
}

module.exports = {
  COOKIE_NAME,
  signSession,
  verifySession,
  parseCookies,
  setCookie,
  clearCookie
};
