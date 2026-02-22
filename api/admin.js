const $ = (id)=>document.getElementById(id);

function show(text, ok=true){
  const m = $("msg");
  m.style.display="block";
  m.className="msg " + (ok?"ok":"err");
  m.textContent=text;
}

function key(){
  return sessionStorage.getItem("aq_panelkey") || "";
}

$("save").addEventListener("click", ()=>{
  const v = $("k").value.trim();
  if(!v) return show("Pon tu PanelKey.", false);
  sessionStorage.setItem("aq_panelkey", v);
  show("Guardado ✅", true);
});

async function api(path, method="GET", body=null){
  const r = await fetch(path, {
    method,
    headers: {
      "content-type":"application/json",
      "x-panel-key": key()
    },
    body: body ? JSON.stringify(body) : null
  });
  const out = await r.json().catch(()=>({}));
  if(!r.ok || out.error) throw new Error(out.error || ("HTTP " + r.status));
  return out;
}

function esc(s){
  return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

async function loadPending(){
  try{
    if(!key()) return show("Falta PanelKey.", false);
    $("list").innerHTML = "";
    show("Cargando…", true);

    const out = await api("/api/admin_pending");
    const rows = out.data || [];
    if(!rows.length){
      $("list").innerHTML = `<div class="item"><div class="t">No hay pendientes.</div></div>`;
      show("Listo ✅", true);
      return;
    }

    $("list").innerHTML = rows.map(b => `
      <div class="item">
        <div class="t">${esc(b.name)} • ${esc(b.kind)} • ${esc(b.municipality)} • ${esc(b.locality)}</div>
        <div class="m">
          <b>Categoría:</b> ${esc(b.category_primary)}<br>
          <b>WhatsApp:</b> ${esc(b.whatsapp)} ${b.phone ? " • <b>Tel:</b> " + esc(b.phone) : ""}<br>
          ${b.description ? "<b>Desc:</b> " + esc(b.description) + "<br>" : ""}
        </div>

        <div class="actions">
          <button class="mini primary" data-approve="${b.id}" data-verified="1">Aprobar + Verificar</button>
          <button class="mini" data-approve="${b.id}" data-verified="0">Aprobar</button>
          <button class="mini" data-login="${b.id}">Crear usuario/contraseña</button>
        </div>
      </div>
    `).join("");

    // Aprobar
    document.querySelectorAll("[data-approve]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        try{
          const business_id = btn.getAttribute("data-approve");
          const verified = btn.getAttribute("data-verified") === "1";
          await api("/api/admin_approve", "POST", { business_id, verified });
          show("Aprobado ✅", true);
          await loadPending();
        }catch(e){
          show("Error: " + (e.message||""), false);
        }
      });
    });

    // Crear login
    document.querySelectorAll("[data-login]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        try{
          const business_id = btn.getAttribute("data-login");
          const username = prompt("Usuario (ej: tacosjuan). Solo letras/números/punto/guion:");
          if(!username) return;

          const out2 = await api("/api/admin_create_login", "POST", { business_id, username });
          alert("COPIA ESTO y MÁNDASELO AL NEGOCIO:\n\nUsuario: " + out2.username + "\nContraseña: " + out2.password);
          show("Login creado ✅", true);
        }catch(e){
          show("Error: " + (e.message||""), false);
        }
      });
    });

    show("Listo ✅", true);
  }catch(e){
    show("Error: " + (e.message||""), false);
  }
}

$("load").addEventListener("click", loadPending);
