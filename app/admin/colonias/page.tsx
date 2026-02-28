"use client";

import { useEffect, useState } from "react";

type Municipality = { id: number; name: string; status: "active" | "coming_soon" };

export default function ColoniasPage() {
  const [key, setKey] = useState("");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [municipalityId, setMunicipalityId] = useState<number>(1);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function loadMunicipios() {
    setMsg(null);
    const r = await fetch("/api/admin/municipalities", { headers: { "x-admin-panel-key": key } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Error cargando municipios");
    setMunicipalities(j.municipalities || []);
    if ((j.municipalities || []).length > 0) setMunicipalityId((j.municipalities || [])[0].id);
  }

  async function importColonias() {
    setMsg(null);
    const r = await fetch("/api/admin/colonies/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-panel-key": key },
      body: JSON.stringify({ municipality_id: municipalityId, text }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j?.error || "Error importando colonias");
    setMsg(`OK: líneas=${j.total_lines} · insertadas/ignoradas=${j.inserted_or_kept}`);
    setText("");
  }

  useEffect(() => {}, []);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, color: "#0A1F44" }}>Colonias</h1>
      <p style={{ color: "#444", marginBottom: 16 }}>Pega lista (una colonia por línea). Duplicadas se ignoran.</p>

      <section style={card}>
        <label style={label}>Clave admin</label>
        <input style={input} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="ADMIN_PANEL_KEY" />
        <button style={btn} disabled={!key.trim()} onClick={loadMunicipios}>Cargar municipios</button>
      </section>

      <section style={card}>
        <label style={label}>Municipio</label>
        <select style={input} value={municipalityId} onChange={(e) => setMunicipalityId(Number(e.target.value))}>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id}>{m.name} ({m.status})</option>
          ))}
        </select>

        <label style={{ ...label, marginTop: 12 }}>Lista de colonias</label>
        <textarea style={{ ...input, minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Centro\nLa Palma\nVilla Juárez\n..."} />

        <button style={{ ...btn, marginTop: 12 }} disabled={!key.trim() || text.trim().length === 0} onClick={importColonias}>
          Importar
        </button>
      </section>

      {msg && <p style={{ color: msg.startsWith("OK:") ? "#1E7E34" : "crimson" }}>{msg}</p>}
      <a href="/admin" style={{ color: "#0A1F44" }}>← Volver</a>
    </main>
  );
}

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
