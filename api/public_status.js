const sb = require("./_supabase");

const TZ = "America/Mazatlan";
const DOW_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function partsNow(){
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit",
    hour12:false,
    weekday:"short"
  });
  const parts = fmt.formatToParts(d);
  const get = (t)=>parts.find(p=>p.type===t)?.value;

  // weekday en es-MX puede venir con punto, normalizamos
  const wdRaw = (get("weekday")||"").toLowerCase().replace(".","");
  const map = { dom:0, lun:1, mar:2, mié:3, mie:3, jue:4, vie:5, sáb:6, sab:6 };
  const dow = map[wdRaw] ?? 0;

  return {
    yyyy: Number(get("year")),
    mm: Number(get("month")),
    dd: Number(get("day")),
    hh: Number(get("hour")),
    mi: Number(get("minute")),
    ss: Number(get("second")),
    dow
  };
}

function minutes(h, m){ return h*60 + m; }
function toHM(str){
  const [h,m] = String(str).slice(0,5).split(":").map(Number);
  return {h, m};
}
function fmtDur(totalMin){
  const m = Math.max(0, Math.floor(totalMin));
  const h = Math.floor(m/60);
  const r = m%60;
  if(h<=0) return `${r} min`;
  if(r===0) return `${h} h`;
  return `${h} h ${r} min`;
}

module.exports = async function handler(req,res){
  try{
    if(req.method !== "GET") return res.status(405).json({ error:"Method not allowed" });

    const business_id = req.query?.business_id;
    if(!business_id) return res.status(400).json({ error:"business_id requerido" });

    const supa = sb();

    const now = partsNow();
    const nowMin = minutes(now.hh, now.mi);

    const { data: hours, error } = await supa
      .from("business_hours")
      .select("dow, open_time, close_time, is_closed")
      .eq("business_id", business_id);

    if(error) return res.status(400).json({ error: error.message });

    const byDow = new Map((hours||[]).map(r => [Number(r.dow), r]));

    // helper: buscar próximo día abierto (máximo 7)
    function nextOpen(){
      for(let i=0;i<7;i++){
        const d = (now.dow + i) % 7;
        const row = byDow.get(d);
        if(!row || row.is_closed) continue;
        const ot = toHM(row.open_time);
        const openMin = minutes(ot.h, ot.m);

        if(i===0){
          // hoy: si ya pasó la hora de abrir, lo ignoramos para "abre en"
          if(nowMin < openMin) return { inDays:i, openMin, dow:d };
        }else{
          return { inDays:i, openMin, dow:d };
        }
      }
      return null;
    }

    const today = byDow.get(now.dow);

    if(!today || today.is_closed){
      const n = nextOpen();
      if(!n) return res.status(200).json({ ok:true, is_open_now:false, text:"Cerrado (sin horarios)", dow: now.dow });

      const minsUntil = (n.inDays*1440) + (n.openMin - nowMin);
      const when = n.inDays === 0 ? "hoy" : `el ${DOW_NAMES[n.dow]}`;
      return res.status(200).json({ ok:true, is_open_now:false, text:`Abre ${when} en ${fmtDur(minsUntil)}` });
    }

    const ot = toHM(today.open_time);
    const ct = toHM(today.close_time);
    const openMin = minutes(ot.h, ot.m);
    const closeMin = minutes(ct.h, ct.m);

    // Modelo simple: mismo día (no cruzamos medianoche)
    if(nowMin >= openMin && nowMin < closeMin){
      const minsLeft = closeMin - nowMin;
      return res.status(200).json({ ok:true, is_open_now:true, text:`Cierra en ${fmtDur(minsLeft)}` });
    }

    if(nowMin < openMin){
      return res.status(200).json({ ok:true, is_open_now:false, text:`Abre hoy en ${fmtDur(openMin - nowMin)}` });
    }

    // ya cerró hoy
    const n = nextOpen();
    if(!n) return res.status(200).json({ ok:true, is_open_now:false, text:"Cerrado", dow: now.dow });

    const minsUntil = (n.inDays*1440) + (n.openMin - nowMin);
    const when = `el ${DOW_NAMES[n.dow]}`;
    return res.status(200).json({ ok:true, is_open_now:false, text:`Abre ${when} en ${fmtDur(minsUntil)}` });
  }catch(e){
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
