const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  try {
    // 1) Token primero (si no viene, debe responder 401, no 500)
    const token = req.headers["x-admin-token"];
    if (!token || token !== process.env.ADMIN_PANEL_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 2) Crear cliente (usa service role desde env vars)
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3) Acciones
    if (req.method === "GET") {
      const action = req.query.action;

      if (action === "list_pending") {
        const { data, error } = await sb
          .from("businesses")
          .select("id,name,kind,category_slug,locality,whatsapp,created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (error) return res.status(400).json({ error: error.message });
        return res.json({ data });
      }

      return res.status(400).json({ error: "Unknown action" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
