const crypto = require("crypto");
const sb = require("./_supabase");

function norm(s){ return (s||"").toString().trim(); }
function cleanUser(s){
  return norm(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9._-]+/g,"")
    .slice(0, 30);
}
function makePassword(){
  // fuerte y simple (sin confundir mucho): 12 chars
  return crypto.randomBytes(9).toString("base64").replaceAll("+","a").replaceAll("/","b").replaceAll("=","").slice(0,12);
}
function hashPass(pass){
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(pass, salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2$120000$${salt}$${hash}`;
}

module.exports = async function handler(req, res) {
  try{
    if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

    const key = req.headers["x-panel-key"];
    if (!key || key !== process.env.PANELKEY) return res.status(401).json({ error:"Unauthorized" });

    const { business_id, username } = req.body || {};
    if (!business_id) return res.status(400).json({ error:"business_id requerido" });

    const user = cleanUser(username || "");
    if (!user || user.length < 4) return res.status(400).json({ error:"username inválido (mín 4)" });

    const supa = sb();

    // evitar duplicados por negocio
    const existing = await supa
      .from("business_logins")
      .select("id")
      .eq("business_id", business_id)
      .maybeSingle();

    if (existing.data?.id) {
      return res.status(400).json({ error:"Este negocio ya tiene usuario. (Si quieres reset, lo hacemos después)" });
    }

    const pass = makePassword();
    const pass_hash = hashPass(pass);

    const ins = await supa
      .from("business_logins")
      .insert([{ business_id, username: user, pass_hash, is_enabled: true }]);

    if (ins.error) return res.status(400).json({ error: ins.error.message });

    return res.status(200).json({
      ok: true,
      username: user,
      password: pass
    });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
