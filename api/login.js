const crypto = require("crypto");
const sb = require("./_supabase");
const { signSession, setCookie } = require("./_auth");

function norm(s){ return (s||"").toString().trim(); }

function verifyPass(pass, stored) {
  // stored: pbkdf2$120000$$salt$$hash
  if (!stored || !stored.startsWith("pbkdf2$")) return false;
  const parts = stored.split("$$");
  if (parts.length !== 3) return false;

  const left = parts[0]; // pbkdf2$iters
  const salt = parts[1];
  const hashHex = parts[2];

  const iters = parseInt(left.split("$")[1] || "0", 10);
  if (!iters || iters < 50000) return false;

  const cand = crypto.pbkdf2Sync(pass, salt, iters, 32, "sha256").toString("hex");

  const a = Buffer.from(cand, "hex");
  const b = Buffer.from(hashHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  try{
    if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

    const { username, password } = req.body || {};
    const u = norm(username).toLowerCase();
    const p = norm(password);

    if (!u || u.length < 4) return res.status(400).json({ error:"Usuario inválido" });
    if (!p || p.length < 6) return res.status(400).json({ error:"Contraseña inválida" });

    const supa = sb();

    const { data, error } = await supa
      .from("business_logins")
      .select("id, business_id, username, pass_hash, is_enabled")
      .eq("username", u)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!data || !data.is_enabled) return res.status(401).json({ error:"Usuario o contraseña incorrectos" });

    if (!verifyPass(p, data.pass_hash)) {
      return res.status(401).json({ error:"Usuario o contraseña incorrectos" });
    }

    // Sesión 7 días
    const payload = { bid: data.business_id, u: data.username, exp: Date.now() + 7*24*60*60*1000 };
    const token = signSession(payload);
    setCookie(res, token, 7*24*60*60);

    return res.status(200).json({ ok:true });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
