const sb = require("./_supabase");

const TZ = "America/Mazatlan";
const DOW_MAP = { dom:0, lun:1, mar:2, mié:3, mie:3, jue:4, vie:5, sáb:6, sab:6 };

function tzPartsNow(){
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    year:"numeric", month:"2-digit", day:"2-digit",
    weekday:"short",
    hour:"2-digit", minute:"2-digit", second:"2-digit",
    hour12:false
  });
  const parts = fmt.formatToParts(d);
  const get = (t)=>parts.find(p=>p.type===t)?.value;
  const wdRaw = (get("weekday")||"").toLowerCase().replace(".","");
  return {
    yyyy: Number(get("year")),
    mm: Number(get("month")),
    dd: Number(get("day")),
    dow: DOW_MAP[wdRaw] ?? 0,
    hh: Number(get("hour")),
    mi: Number(get("minute")),
    ss: Number(get("second"))
  };
}

function todayBoundsUTC(){
  // calcula inicio/fin del "día local" (Mazatlán) como timestamps UTC
  const p = tzPartsNow();
  const msSinceMidnight = ((p.hh * 60 + p.mi) * 60 + p.ss) * 1000;
  const start = new Date(Date.now() - msSinceMidnight);
  const end = new Date(start.getTime() + 24*60*60*1000 - 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function norm(s){ return (s||"").toString().trim(); }

module.exports = async function handler(req,res){
  try{
    if(req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });

    const supa = sb();

    const municipality = norm(req.query.municipality || "Navolato");
    const locality = norm(req.query.locality || "");

    const { startISO, endISO } = todayBoundsUTC();

    // Traer promos del día (Mazatlán), unidas con business info
    // Reglas: solo approved + kind=food + verified + plan_tier != free
    // Nota: usamos dos consultas (promos y luego businesses) para evitar joins raros.

    const promos = await supa
      .from("promotions")
      .select("id,business_id,text,created_at")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(100);

    if(promos.error) return res.status(400).json({ error: promos.error.message });

    const rows = promos.data || [];
    if(!rows.length) return res.status(200).json({ ok:true, data: [] });

    const ids = [...new Set(rows.map(r=>r.business_id))];

    let qb = supa
      .from("businesses")
      .select("id,name,kind,municipality,locality,category_primary,description,whatsapp,phone,delivery,pickup,dine_in,verified,plan_tier,profile_photo_url,status")
      .in("id", ids)
      .eq("status","approved")
      .eq("kind","food")
      .eq("municipality", municipality);

    if(locality) qb = qb.eq("locality", locality);

    const biz = await qb;
    if(biz.error) return res.status(400).json({ error: biz.error.message });

    const okBiz = (biz.data || []).filter(b => b.verified && (b.plan_tier || "free") !== "free");
    const byId = new Map(okBiz.map(b => [b.id, b]));

    const out = rows
      .map(p => {
        const b = byId.get(p.business_id);
        if(!b) return null;
        return {
          promo_id: p.id,
          promo_text: p.text,
          created_at: p.created_at,
          business: b
        };
      })
      .filter(Boolean);

    return res.status(200).json({ ok:true, data: out });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
