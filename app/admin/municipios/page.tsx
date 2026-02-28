"use client";

import { useEffect, useMemo, useState } from "react";

type Municipality = { id: number; name: string; status: "active" | "coming_soon" };

export default function MunicipiosPage() {
  const [key, setKey] = useState("");
  const [items, setItems] = useState<Municipality[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "coming_soon">("coming_soon");
  const [msg, setMsg] = useState<string | null>(null);
  const can = useMemo(() => key.trim().length > 0, [key]);

  async function load() {
    setMsg(null);
    const r = await fetch("/api/admin/municipalities", { headers: { "x-admin-panel-key": key } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Error cargando municipios");
    setItems(j.municipalities || []);
  }

  async function create() {
    setMsg(null);
    const r = await fetch("/api/admin/municipalities", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-panel-key": key },
      body: JSON.stringify({ name, status }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Error creando municipio");
    setName("");
    await load();
  }

  async function setMunicipioStatus(id: number, st: "active" | "coming_soon") {
    setMsg(null);
    const r = await fetch(`/api/admin/municipalities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-panel-key": key },
      body: JSON.stringify({ status: st }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Error actualizando");
    await load();
  }

  useEffect(() => {
    // no auto-load sin key
  }, []);

  return (
    <main style={wrap}>
      <h1 style={h1}>Municipios</h1>
      <p style={p}>Pega tu clave admin para operar. (No se guarda.)</p>

      <section style={card}>
        <label style={label}>Clave admin</label>
        <input style={input} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="ADMIN_PANEL_KEY" />
        <button style={btn} disabled={!can} onClick={load}>Cargar</button>
      </section>

      <section style={card}>
        <h2 style={h2}>Crear municipio</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Culiacán" />
          <select style={input} value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="active">active</option>
            <option value="coming_soon">coming_soon</option>
          </select>
          <button style={btn} disabled={!can || name.trim().length < 2} onClick={create}>Crear</button>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>Lista</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((m) => (
            <div key={m.id} style={row}>
              <div>
                <b>{m.name}</b>
                <div style={{ color: "#555" }}>id: {m.id} · status: {m.status}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnSmall} disabled={!can} onClick={() => setMunicipioStatus(m.id, "active")}>Activar</button>
                <button style={btnSmall} disabled={!can} onClick={() => setMunicipioStatus(m.id, "coming_soon")}>Próx.</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ color: "#666" }}>Sin municipios (o no has cargado).</div>}
        </div>
      </section>

      {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      <a href="/admin" style={{ color: "#0A1F44" }}>← Volver</a>
    </main>
  );
}

const wrap: React.CSSProperties = { padding: 24, maxWidth: 900, margin: "0 auto" };
const h1: React.CSSProperties = { fontSize: 28, fontWeight: 800, marginBottom: 6, color: "#0A1F44" };
const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, marginBottom: 10, color: "#0A1F44" };
const p: React.CSSProperties = { color: "#444", marginBottom: 16 };
const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #EAEAEA",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  marginBottom: 14,
};
const label: React.CSSProperties = { fontSize: 12, color: "#555", marginBottom: 6, display: "block" };
const input: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" };
const btn: React.CSSProperties = { padding: 12, borderRadius: 12, border: 0, cursor: "pointer" };
const btnSmall: React.CSSProperties = { padding: "10px 12px", borderRadius: 12, border: 0, cursor: "pointer" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: "1px solid #eee", borderRadius: 14, padding: 12 };
