const sb = require("./supabase");

module.exports = async function handler(req,res){
  try{
    if(req.method !== "POST"){
      return res.status(405).json({error:"Method not allowed"});
    }

    const { business_id } = req.body;
    if(!business_id){
      return res.status(400).json({error:"Falta business_id"});
    }

    const supa = sb();
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // 🔹 Verificar última recomendación de esa IP
    const oneHourAgo = new Date(Date.now() - 60*60*1000).toISOString();

    const { data } = await supa
      .from("recommendations")
      .select("*")
      .eq("business_id", business_id)
      .eq("ip", ip)
      .gte("created_at", oneHourAgo);

    if(data && data.length > 0){
      return res.status(429).json({error:"Solo puedes recomendar una vez por hora"});
    }

    await supa
      .from("recommendations")
      .insert({ business_id, ip });

    return res.status(200).json({ok:true});

  }catch{
    return res.status(500).json({error:"Error interno"});
  }
};
