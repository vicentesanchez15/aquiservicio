const jwt = require("jsonwebtoken");

const SECRET = process.env.PANELKEY;

module.exports = async function handler(req,res){
  try{
    const cookie = req.headers.cookie || "";
    const match = cookie.match(/session=([^;]+)/);

    if(!match){
      return res.status(401).json({error:"No autorizado"});
    }

    const decoded = jwt.verify(match[1], SECRET);
    return res.status(200).json({ok:true, user:decoded});

  }catch{
    return res.status(401).json({error:"No autorizado"});
  }
};
