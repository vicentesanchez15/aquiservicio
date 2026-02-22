const { createClient } = require("@supabase/supabase-js");

function norm(s){ return (s || "").toString().trim(); }
function ymdLocal(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const kind = norm(req.query.kind); // "food" | "service"
    const municipality = norm(req.query.municipality);
    const locality = norm(req.query.locality); // opcional

    if (!["food","service"].includes(kind)) return res.status(400).json({ error: "kind inválido" });
    if (!municipality) return res.status(400).json({ error: "municipality requerido" });

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // promos del día (por created_at)
    const day = ymdLocal();
    const start = day + "T00:00:00";
    const end   = day + "T23:59:59";

    let q = sb
      .from("promotions")
      .select("id, business_id, text, created_at, businesses!inner(id,name,verified,status,kind,municipality,locality,whatsapp,phone)")
      .gte("created_at", start)
      .lte("created_at", end);

    // filtros del negocio (join)
    q = q.eq("businesses.status", "approved")
         .eq("businesses.verified", true)
         .eq("businesses.kind", kind)
         .eq("businesses.municipality", municipality);

    if (locality) q = q.eq("businesses.locality", locality);

    const { data, error } = await q.order("created_at", { ascending:false });
    if (error) return res.status(400).json({ error: error.message });

    // normalizar salida
    const out = (data || []).map(p => ({
      id: p.id,
      text: p.text,               // <- si tu columna se llama distinto, cámbiala aquí
      created_at: p.created_at,
      business: p.businesses
    }));

    return res.status(200).json({ data: out });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
