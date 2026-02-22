const { createClient } = require("@supabase/supabase-js");

function cleanPhone(s){
  return (s || "").toString().replace(/\D/g, "").slice(0, 15);
}
function slugify(s){
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // ✅ Anti-spam básico (honeypot)
    // Si viene lleno, es bot.
    if (req.body && req.body.hp) return res.status(200).json({ ok: true });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      kind, locality, name, category, description,
      whatsapp, phone, tags,
      delivery, pickup, dine_in, available_now
    } = req.body || {};

    // ✅ Validaciones mínimas
    if (!["food", "service"].includes(kind)) return res.status(400).json({ error: "Tipo inválido" });
    if (!locality || locality.length < 3) return res.status(400).json({ error: "Localidad requerida" });
    if (!name || name.length < 3) return res.status(400).json({ error: "Nombre requerido" });
    if (!category || category.length < 2) return res.status(400).json({ error: "Categoría requerida" });

    const wa = cleanPhone(whatsapp);
    if (wa.length < 10) return res.status(400).json({ error: "WhatsApp inválido" });

    const payload = {
      status: "pending",
      verified: false,
      plan: "free",
      subscription_status: "inactive",
      paid_until: null,

      kind,
      category_slug: slugify(category) || "sin-categoria",
      name: name.trim(),
      description: description ? String(description).trim().slice(0, 500) : null,

      whatsapp: wa,
      phone: cleanPhone(phone) || null,

      municipality: "Navolato",
      locality: String(locality).trim().slice(0, 60),

      delivery: !!delivery,
      pickup: !!pickup,
      dine_in: !!dine_in,

      available_now: !!available_now,
      temporarily_closed: false,
      closed_reason: null,
    };

    const { data, error } = await sb.from("businesses").insert([payload]).select("id");
    if (error) return res.status(400).json({ error: error.message });

    const business_id = data?.[0]?.id;

    // ✅ Tags opcionales (si existe business_tags)
    const tagList = Array.isArray(tags) ? tags : [];
    if (business_id && tagList.length) {
      const rows = tagList
        .map(t => String(t).trim())
        .filter(Boolean)
        .slice(0, 20)
        .map(t => ({ business_id, tag: t }));

      if (rows.length) {
        const tRes = await sb.from("business_tags").insert(rows);
        // si falla tags, no rompemos
        if (tRes.error) console.log("tags error:", tRes.error.message);
      }
    }

    return res.status(200).json({ ok: true, business_id });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
