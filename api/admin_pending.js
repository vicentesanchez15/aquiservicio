const sb = require("./_supabase");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const key = req.headers["x-panel-key"];
    if (!key || key !== process.env.PANELKEY) return res.status(401).json({ error: "Unauthorized" });

    const supa = sb();

    const { data, error } = await supa
      .from("businesses")
      .select("id,status,verified,kind,municipality,locality,name,category_primary,whatsapp,phone,delivery,pickup,dine_in,available_now,coverage_note,description,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
