const sb = require("./supabase");

function now(){
  return new Date().toISOString();
}

module.exports = async function handler(req,res){
  try{
    if(req.method !== "GET"){
      return res.status(405).json({error:"Method not allowed"});
    }

    const supa = sb();
    const { kind, municipality, locality, category, q, open } = req.query;

    if(!kind || !municipality){
      return res.status(400).json({error:"Faltan parámetros"});
    }

    // 🔹 Primero actualizamos planes vencidos
    await supa
      .from("businesses")
      .update({ plan:"free", verified:false })
      .lt("plan_expires_at", now())
      .neq("plan","free");

    // 🔹 Ahora traemos negocios
    let query = supa
      .from("businesses")
      .select("*")
      .eq("kind", kind)
      .eq("municipality", municipality)
      .eq("status","approved");

    if(locality) query = query.eq("locality", locality);
    if(category) query = query.eq("category_primary", category);

    const { data, error } = await query;

    if(error){
      return res.status(400).json({error:error.message});
    }

    let results = data || [];

    // 🔹 Buscar por texto
    if(q){
      const search = q.toLowerCase();
      results = results.filter(b =>
        (b.name||"").toLowerCase().includes(search) ||
        (b.description||"").toLowerCase().includes(search)
      );
    }

    // 🔹 Solo abiertos
    if(open === "1"){
      results = results.filter(b => b.available_now === true);
    }

    // 🔹 Orden: verificados primero
    results.sort((a,b)=>{
      if(a.verified === b.verified) return 0;
      return a.verified ? -1 : 1;
    });

    return res.status(200).json({ok:true,data:results});

  }catch(e){
    return res.status(500).json({error:"Error interno"});
  }
};
