const sb = require("./_supabase");
const { parseCookies, verifySession, COOKIE_NAME } = require("./_auth");

function norm(s){ return (s||"").toString().trim(); }
function clamp(s,n){ const t = norm(s); return t ? t.slice(0,n) : null; }

function ymdLocal(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

module.exports = async function handler(req,res){
  try{
    if(req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);
    if(!sess) return res.status(401).json({ error:"No auth" });

    const supa = sb();

    const me = await supa
      .from("businesses")
      .select("id, plan_tier, verified, status, kind, municipality, locality, name, whatsapp, phone")
      .eq("id", sess.bid)
      .maybeSingle();

    if(me.error) return res.status(400).json({ error: me.error.message });
    if(!me.data) return res.status(404).json({ error:"No encontrado" });
    if(me.data.status !== "approved") return res.status(403).json({ error:"Negocio no aprobado" });

    const isPro = (me.data.plan_tier || "free") !== "free";
    if(!isPro) return res.status(403).json({ error:"Función disponible al activar plan" });

    // Si quieres obligar a verificados:
    if(!me.data.verified) return res.status(403).json({ error:"Solo disponible para verificados" });

    const text = clamp(req.body?.text, 180);
    if(!text || text.length < 6) return res.status(400).json({ error:"Escribe una promo más clara (mín 6)" });

    // 1 por día
    const day = ymdLocal();
    const start = day + "T00:00:00";
    const end   = day + "T23:59:59";

    const exists = await supa
      .from("promotions")
      .select("id")
      .eq("business_id", sess.bid)
      .gte("created_at", start)
      .lte("created_at", end)
      .limit(1);

    if(exists.error) return res.status(400).json({ error: exists.error.message });
    if((exists.data || []).length) return res.status(429).json({ error:"Ya publicaste una promoción hoy" });

    const ins = await supa
      .from("promotions")
      .insert([{ business_id: sess.bid, text }])
      .select("id, text, created_at");

    if(ins.error) return res.status(400).json({ error: ins.error.message });

    return res.status(200).json({ ok:true, data: ins.data?.[0] || null });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
