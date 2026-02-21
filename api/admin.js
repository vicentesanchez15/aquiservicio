const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  try {
    const token = req.headers["x-admin-token"];
    if (!token || token !== process.env.ADMIN_PANEL_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const action = req.query.action;

    if (action === "count_pending") {
      const { count, error } = await sb
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ pending_count: count });
    }

    if (action === "list_pending") {
      const { data, error } = await sb
        .from("businesses")
        .select("id,name,kind,category_slug,locality,whatsapp,created_at,status")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) return res.status(400).json({ error: error.message });
      return res.json({ data });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};    return res.status(500).json({ error: e.message || "Server error" });
  }
};
