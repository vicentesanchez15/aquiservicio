const sb = require("./supabase");

module.exports = async function handler(req,res){
  try{
    if(req.method !== "POST"){
      return res.status(405).json({error:"Method not allowed"});
    }

    if(req.headers["x-panel-key"] !== process.env.PANELKEY){
      return res.status(403).json({error:"No autorizado"});
    }

    const { business_id, plan } = req.body;

    if(!business_id || !plan){
      return res.status(400).json({error:"Faltan datos"});
    }

    const supa = sb();

    const { error } = await supa
      .from("businesses")
      .update({
        plan,
        verified: plan !== "free",
        plan_expires_at: new Date(Date.now() + 30*24*60*60*1000)
      })
      .eq("id", business_id);

    if(error){
      return res.status(400).json({error:error.message});
    }

    return res.status(200).json({ok:true});

  }catch{
    return res.status(500).json({error:"Error interno"});
  }
};
