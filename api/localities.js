const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const municipality = (req.query.municipality || "").toString().trim();
    if (!municipality) return res.status(400).json({ error: "municipality requerido" });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Por ahora: solo Navolato tiene tabla de localidades
    if (municipality.toLowerCase() !== "navolato") {
      return res.status(200).json({ data: [] });
    }

    const { data, error } = await sb
      .from("zonas_navolato")
      .select("name")
      .order("name", { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ data: data || [] });

  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
