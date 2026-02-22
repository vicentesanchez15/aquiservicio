const sb = require("./_supabase");
const { parseCookies, verifySession, COOKIE_NAME } = require("./_auth");

function norm(s){ return (s||"").toString().trim(); }
function cleanPhone(s){ return (s||"").toString().replace(/\D/g,"").slice(0,15); }
function clamp(s,n){ const t = norm(s); return t ? t.slice(0,n) : null; }
function isHttpUrl(u){
  const t = norm(u);
  if(!t) return null;
  try{
    const x = new URL(t);
    if(x.protocol !== "http:" && x.protocol !== "https:") return null;
    return t.slice(0, 350);
  }catch{ return null; }
}
function asArray5(v){
  if(!Array.isArray(v)) return [];
  const out = [];
  for(const it of v){
    const u = isHttpUrl(it);
    if(u) out.push(u);
    if(out.length >= 5) break;
  }
  return out;
}

module.exports = async function handler(req,res){
  try{
    if(req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);
    if(!sess) return res.status(401).json({ error:"No auth" });

    const supa = sb();

    // Traer plan del negocio
    const me = await supa
      .from("businesses")
      .select("id, plan_tier, verified, status, kind")
      .eq("id", sess.bid)
      .maybeSingle();

    if(me.error) return res.status(400).json({ error: me.error.message });
    if(!me.data) return res.status(404).json({ error:"No encontrado" });
    if(me.data.status !== "approved") return res.status(403).json({ error:"Negocio no aprobado" });

    const b = req.body || {};

    const payload = {
      // campos básicos editables SIEMPRE
      description: clamp(b.description, 700),
      coverage_note: clamp(b.coverage_note, 80),

      phone: cleanPhone(b.phone) || null,

      delivery: !!b.delivery,
      pickup: !!b.pickup,
      dine_in: !!b.dine_in,

      available_now: (me.data.kind === "service") ? !!b.available_now : false,

      updated_at: new Date().toISOString()
    };

    // Campos PRO (bloqueados si free)
    const isPro = (me.data.plan_tier || "free") !== "free";

    if(isPro){
      payload.profile_photo_url = isHttpUrl(b.profile_photo_url);
      payload.gallery_urls = asArray5(b.gallery_urls);
    }

    const up = await supa
      .from("businesses")
      .update(payload)
      .eq("id", sess.bid)
      .select("id,plan_tier,profile_photo_url,gallery_urls,updated_at");

    if(up.error) return res.status(400).json({ error: up.error.message });

    return res.status(200).json({ ok:true, data: up.data?.[0] || null });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
