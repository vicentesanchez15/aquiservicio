const sb = require("./_supabase");
const { parseCookies, verifySession, COOKIE_NAME } = require("./_auth");

module.exports = async function handler(req, res) {
  try{
    if (req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });

    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);
    if (!sess) return res.status(401).json({ error:"No auth" });

    const supa = sb();
    const { data, error } = await supa
      .from("businesses")
      .select("id,status,verified,kind,municipality,locality,name,category_primary,whatsapp,phone,delivery,pickup,dine_in,available_now,coverage_note,description")
      .eq("id", sess.bid)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error:"No encontrado" });

    return res.status(200).json({ data });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
