import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const token = req.headers["x-admin-token"];

    if (!token || token !== process.env.ADMIN_PANEL_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("status", "pending");

      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: "Invalid request" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
