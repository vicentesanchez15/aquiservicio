const sb = require("./_supabase");
const { parseCookies, verifySession, COOKIE_NAME } = require("./_auth");

function norm(s){ return (s||"").toString().trim(); }
function isHttpUrl(u){
  const t = norm(u);
  if(!t) return null;
  try{
    const x = new URL(t);
    if(x.protocol !== "http:" && x.protocol !== "https:") return null;
    return t.slice(0, 350);
  }catch{ return null; }
}

module.exports = async function handler(req,res){
  try{
    if(req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);
    if(!sess) return res.status(401).json({ error:"No auth" });

    const { kind, publicUrl } = req.body || {};
    const k = norm(kind); // "profile" | "gallery"
    const url = isHttpUrl(publicUrl);

    if(!["profile","gallery"].includes(k)) return res.status(400).json({ error:"kind inválido" });
    if(!url) return res.status(400).json({ error:"publicUrl inválida" });

    const supa = sb();

    const me = await supa
      .from("businesses")
      .select("id, status, plan_tier, gallery_urls")
      .eq("id", sess.bid)
      .maybeSingle();

    if(me.error) return res.status(400).json({ error: me.error.message });
    if(!me.data) return res.status(404).json({ error:"No encontrado" });
    if(me.data.status !== "approved") return res.status(403).json({ error:"Negocio no aprobado" });

    const isPro = (me.data.plan_tier || "free") !== "free";
    if(!isPro) return res.status(403).json({ error:"Función disponible al activar plan" });

    let patch = { updated_at: new Date().toISOString() };

    if(k === "profile"){
      patch.profile_photo_url = url;
    }else{
      const current = Array.isArray(me.data.gallery_urls) ? me.data.gallery_urls : [];
      const next = current.filter(Boolean);
      if(next.includes(url)) return res.status(200).json({ ok:true, data:{ gallery_urls: next } });
      if(next.length >= 5) return res.status(400).json({ error:"Máximo 5 imágenes" });
      next.push(url);
      patch.gallery_urls = next;
    }

    const up = await supa
      .from("businesses")
      .update(patch)
      .eq("id", sess.bid)
      .select("profile_photo_url,gallery_urls,updated_at");

    if(up.error) return res.status(400).json({ error: up.error.message });

    return res.status(200).json({ ok:true, data: up.data?.[0] || null });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
