const sb = require("./supabase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET = process.env.PANELKEY;

module.exports = async function handler(req,res){
  try{
    if(req.method !== "POST"){
      return res.status(405).json({error:"Method not allowed"});
    }

    const { username, password } = req.body;

    if(!username || !password){
      return res.status(400).json({error:"Faltan datos"});
    }

    const supa = sb();

    const { data, error } = await supa
      .from("businesses")
      .select("*")
      .eq("username", username)
      .eq("status","approved")
      .single();

    if(error || !data){
      return res.status(401).json({error:"Credenciales inválidas"});
    }

    const valid = await bcrypt.compare(password, data.password_hash);
    if(!valid){
      return res.status(401).json({error:"Credenciales inválidas"});
    }

    const token = jwt.sign(
      { id:data.id, role:data.role },
      SECRET,
      { expiresIn:"7d" }
    );

    res.setHeader("Set-Cookie", `session=${token}; HttpOnly; Path=/; SameSite=Strict; Secure`);
    return res.status(200).json({ok:true});

  }catch(e){
    return res.status(500).json({error:"Error interno"});
  }
};
