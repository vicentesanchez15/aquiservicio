const sb = require("./_supabase");
const { parseCookies, verifySession, COOKIE_NAME } = require("./_auth");

function norm(s){ return (s||"").toString().trim(); }
function isTimeHHMM(s){
  const t = norm(s);
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
}

module.exports = async function handler(req,res){
  try{
    if(req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });

    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);
    if(!sess) return res.status(401).json({ error:"No auth" });

    const rows = req.body?.rows;
    if(!Array.isArray(rows) || rows.length !== 7) return res.status(400).json({ error:"rows debe traer 7 días" });

    // validar
    for(const r of rows){
      const dow = Number(r.dow);
      if(!Number.isInteger(dow) || dow < 0 || dow > 6) return res.status(400).json({ error:"dow inválido" });

      const is_closed = !!r.is_closed;
      const open_time = norm(r.open_time);
      const close_time = norm(r.close_time);

      if(!is_closed){
        if(!isTimeHHMM(open_time) || !isTimeHHMM(close_time)) return res.status(400).json({ error:"Hora inválida (HH:MM)" });
        if(open_time >= close_time) return res.status(400).json({ error:"open_time debe ser menor a close_time" });
      }
    }

    const supa = sb();

    // upsert 7 días
    const payload = rows.map(r => ({
      business_id: sess.bid,
      dow: Number(r.dow),
      open_time: r.is_closed ? "00:00" : r.open_time,
      close_time: r.is_closed ? "00:00" : r.close_time,
      is_closed: !!r.is_closed,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supa
      .from("business_hours")
      .upsert(payload, { onConflict: "business_id,dow" });

    if(error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ ok:true });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
