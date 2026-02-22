const { createClient } = require("@supabase/supabase-js");

function cleanPhone(s){
  return (s || "").toString().replace(/\D/g, "").slice(0, 15);
}
function norm(s){
  return (s || "").toString().trim();
}
function clamp(s, n){
  const t = norm(s);
  return t ? t.slice(0, n) : null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Anti-bot (honeypot)
    if (req.body && req.body.hp) return res.status(200).json({ ok: true });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const b = req.body || {};

    const kind = norm(b.kind);
    const municipality = norm(b.municipality);
    const locality = norm(b.locality);

    const name = norm(b.name);
    const category_primary = norm(b.category_primary);

    const whatsapp = cleanPhone(b.whatsapp);
    const phone = cleanPhone(b.phone);

    const delivery = !!b.delivery;
    const pickup = !!b.pickup;
    const dine_in = !!b.dine_in;
    const available_now = !!b.available_now;

    const coverage_note = clamp(b.coverage_note, 80);
    const description = clamp(b.description, 700);

    const offerings = Array.isArray(b.offerings) ? b.offerings.map(x => norm(x)).filter(Boolean).slice(0, 30) : [];
    const hints = Array.isArray(b.hints) ? b.hints.map(x => norm(x)).filter(Boolean).slice(0, 20) : [];

    // Validaciones mínimas
    if (!["food","service"].includes(kind)) return res.status(400).json({ error: "Tipo inválido" });
    if (!municipality || municipality.length < 3) return res.status(400).json({ error: "Municipio requerido" });
    if (!locality || locality.length < 3) return res.status(400).json({ error: "Localidad requerida" });
    if (!name || name.length < 3) return res.status(400).json({ error: "Nombre requerido" });
    if (!category_primary || category_primary.length < 2) return res.status(400).json({ error: "Categoría principal requerida" });
    if (whatsapp.length < 10) return res.status(400).json({ error: "WhatsApp inválido" });

    // 1) Insert business (ajustado a columnas típicas)
    const businessPayload = {
      status: "pending",
      verified: false,

      kind,
      municipality,
      locality,

      name,
      category_primary,

      whatsapp,
      phone: phone || null,

      delivery,
      pickup,
      dine_in,

      available_now: (kind === "service") ? available_now : false,

      coverage_note,
      description
    };

    const { data, error } = await sb
      .from("businesses")
      .insert([businessPayload])
      .select("id");

    if (error) return res.status(400).json({ error: error.message });

    const business_id = data?.[0]?.id;
    if (!business_id) return res.status(500).json({ error: "No se pudo crear negocio" });

    // 2) Insert tags (en business_tags)
    // Guardamos:
    // - offerings como "offer:<x>"
    // - hints como "hint:<x>"
    const rows = [];

    for (const o of offerings) rows.push({ business_id, tag: "offer:" + o });
    for (const h of hints) rows.push({ business_id, tag: "hint:" + h });

    // También metemos la categoría principal como búsqueda
    rows.push({ business_id, tag: "hint:" + category_primary.toLowerCase() });

    // Limitar por seguridad
    const finalRows = rows.slice(0, 60);

    if (finalRows.length) {
      const t = await sb.from("business_tags").insert(finalRows);
      // si falla tags no rompemos
      if (t.error) console.log("business_tags error:", t.error.message);
    }

    return res.status(200).json({ ok: true, business_id });

  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
