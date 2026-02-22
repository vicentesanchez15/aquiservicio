const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await sb
      .from("municipios")
      .select("name")
      .order("name", { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
