const crypto = require("crypto");
const sb = require("./_supabase");
const { parseCookies, verifySession, COOKIE_NAME } = require("./_auth");

function norm(s){ return (s||"").toString().trim(); }
function safeName(s){
  return norm(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9._-]+/g,"-")
    .replace(/-+/g,"-")
    .slice(0, 60);
}

module.exports = async function handler(req, res){
  try{
    if(req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);
    if(!sess) return res.status(401).json({ error:"No auth" });

    const { kind, filename, contentType } = req.body || {};
    const k = norm(kind); // "profile" | "gallery"
    const fn = norm(filename);
    const ct = norm(contentType);

    if(!["profile","gallery"].includes(k)) return res.status(400).json({ error:"kind inválido" });
    if(!fn) return res.status(400).json({ error:"filename requerido" });
    if(!ct.startsWith("image/")) return res.status(400).json({ error:"Solo imágenes" });

    // nombre final (evita colisiones)
    const ext = (fn.split(".").pop() || "jpg").slice(0,6);
    const base = safeName(fn.replace(/\.[^.]+$/, ""));
    const rand = crypto.randomBytes(6).toString("hex");
    const path = `business/${sess.bid}/${k}/${base}-${rand}.${ext}`;

    const supa = sb();

    // 10 minutos para subir
    const { data, error } = await supa.storage
      .from("aq-media")
      .createSignedUploadUrl(path, 600);

    if(error) return res.status(400).json({ error: error.message });

    // URL pública para guardar en DB (porque el bucket es public)
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/aq-media/${path}`;

    return res.status(200).json({
      ok: true,
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl
    });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
