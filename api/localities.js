const sb = require("./_supabase");

function norm(s){ return (s||"").toString().trim(); }

module.exports = async function handler(req, res){
  try{
    if(req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const supa = sb();
    const municipality = norm(req.query.municipality || "Navolato");

    // Preferencia: tabla general localities (municipio + nombre + sort_order)
    const q2 = await supa
      .from("localities")
      .select("name, sort_order")
      .eq("municipality", municipality)
      .order("sort_order", { ascending: true })
      .limit(250);

    if(!q2.error && Array.isArray(q2.data) && q2.data.length){
      const list = [...new Set(q2.data.map(x => x.name).filter(Boolean))];
      return res.status(200).json({ ok:true, data: list });
    }

    // Fallback: tu tabla zonas_navolato (si aún la usas)
    const q1 = await supa
      .from("zonas_navolato")
      .select("name, sort_order")
      .order("sort_order", { ascending: true })
      .limit(250);

    if(q1.error) return res.status(400).json({ error: q1.error.message });

    const list = [...new Set((q1.data || []).map(x => x.name).filter(Boolean))];
    return res.status(200).json({ ok:true, data: list });

  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
