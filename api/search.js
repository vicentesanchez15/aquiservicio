const { createClient } = require("@supabase/supabase-js");

function norm(s){ return (s || "").toString().trim(); }

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const kind = norm(req.query.kind); // "food" | "service"
    const municipality = norm(req.query.municipality);
    const locality = norm(req.query.locality); // opcional
    const offer = norm(req.query.offer);       // opcional (ej: "tacos")
    const q = norm(req.query.q).toLowerCase(); // opcional

    if (!["food", "service"].includes(kind)) return res.status(400).json({ error: "kind inválido" });
    if (!municipality) return res.status(400).json({ error: "municipality requerido" });

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Base: solo aprobados
    let query = sb
      .from("businesses")
      .select("id,status,verified,kind,municipality,locality,name,category_primary,whatsapp,phone,delivery,pickup,dine_in,available_now,coverage_note,description,created_at")
      .eq("status", "approved")
      .eq("kind", kind)
      .eq("municipality", municipality);

    if (locality) query = query.eq("locality", locality);

    // Si viene offer, buscamos por tags offer:<x> o por category_primary que contenga
    // (Esto asume que guardas tags en business_tags con prefijos offer: y hint:)
    // Para no romper si no hay tags, lo hacemos en 2 pasos:
    // 1) Si offer existe -> buscar business_ids por business_tags
    if (offer) {
      const { data: tagRows, error: tagErr } = await sb
        .from("business_tags")
        .select("business_id,tag")
        .ilike("tag", "offer:" + offer + "%");

      if (tagErr) return res.status(400).json({ error: tagErr.message });

      const ids = [...new Set((tagRows || []).map(r => r.business_id).filter(Boolean))];

      // Si encontró ids por tags, filtramos por ids.
      // Si no encontró, igual dejamos que pase y filtramos por category_primary “like”
      if (ids.length) {
        query = query.in("id", ids);
      } else {
        query = query.ilike("category_primary", "%" + offer + "%");
      }
    }

    // Orden: verificados arriba
    query = query.order("verified", { ascending: false }).order("name", { ascending: true });

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    // Filtro extra por q (nombre/desc/categoría) en server (rápido y simple)
    let out = data || [];
    if (q) {
      out = out.filter(b => {
        const hay = [
          b.name, b.category_primary, b.locality, b.coverage_note, b.description
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    return res.status(200).json({ data: out });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
