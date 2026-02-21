const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  try {
    // 🔐 Validar token admin
    const token = req.headers["x-admin-token"];
    if (!token || token !== process.env.ADMIN_PANEL_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔗 Crear cliente Supabase con service role
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Solo permitimos GET por ahora
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = req.query.action;

    // ==============================
    // 🧪 DEBUG: Contar pendientes
    // ==============================
    if (action === "count_pending") {
      const { count, error } = await supabase
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({
        ok: true,
        pending_count: count
      });
    }

    // ==============================
    // 📋 Listar pendientes
    // ==============================
    if (action === "list_pending") {
      const { data, error } = await supabase
        .from("businesses")
        .select("id,name,kind,category_slug,locality,whatsapp,created_at,status")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ data });
    }

    // Acción no reconocida
    return res.status(400).json({ error: "Unknown action" });

  } catch (err) {
    return res.status(500).json({
      error: err.message || "Server error"
    });
  }
};
