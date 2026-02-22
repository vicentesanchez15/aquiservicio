const sb = require("./_supabase");
const { parseCookies, verifySession, COOKIE_NAME } = require("./_auth");

module.exports = async function handler(req, res){
  try{
    if(req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });

    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const sess = verifySession(token);
    if(!sess) return res.status(401).json({ error:"No auth" });

    const supa = sb();

    const { data, error } = await supa
      .from("business_hours")
      .select("dow, open_time, close_time, is_closed")
      .eq("business_id", sess.bid)
      .order("dow", { ascending: true });

    if(error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ ok:true, data: data || [] });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
