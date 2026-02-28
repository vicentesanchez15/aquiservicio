export default function AdminHome() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Admin</h1>
      <p style={{ color: "#444", marginBottom: 18 }}>
        Operación V1: Municipios/Colonias, luego categorías, banner, moderación.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <a href="/admin/municipios" style={cardStyle}>
          <b>Municipios</b>
          <div style={{ color: "#555" }}>Crear y activar “Navolato” y próximos.</div>
        </a>

        <a href="/admin/colonias" style={cardStyle}>
          <b>Colonias</b>
          <div style={{ color: "#555" }}>Import masivo pegando lista por municipio.</div>
        </a>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  borderRadius: 16,
  border: "1px solid #EAEAEA",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  textDecoration: "none",
  color: "#0A1F44",
  background: "white",
};
