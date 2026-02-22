const sb = require("./_supabase");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const key = req.headers["x-panel-key"];
    if (!key || key !== process.env.PANELKEY) return res.status(401).json({ error: "Unauthorized" });

    const { business_id, verified } = req.body || {};
    if (!business_id) return res.status(400).json({ error: "business_id requerido" });

    const supa = sb();

    const { error } = await supa
      .from("businesses")
      .update({
        status: "approved",
        verified: !!verified
      })
      .eq("id", business_id);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
