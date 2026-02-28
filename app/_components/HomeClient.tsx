"use client";

import { useEffect, useMemo, useState } from "react";

type Municipality = { id: number; name: string; status: "active" | "coming_soon" };
type Banner = { id: number; title: string | null; image_url: string; link_url: string | null };

export default function HomeClient() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const activeSelected = useMemo(() => {
    const m = municipalities.find((x) => x.id === selected);
    return m?.status === "active";
  }, [municipalities, selected]);

  useEffect(() => {
    (async () => {
      const m = await fetch("/api/public/municipalities", { cache: "no-store" }).then((r) => r.json());
      const list: Municipality[] = m?.municipalities || [];
      setMunicipalities(list);

      const firstActive = list.find((x) => x.status === "active")?.id ?? (list[0]?.id ?? null);
      setSelected(firstActive);

      const b = await fetch("/api/public/banner", { cache: "no-store" }).then((r) => r.json());
      setBanner(b?.banner ?? null);
    })();
  }, []);

  return (
    <main className="container">
      {/* header */}
      <div className="grid" style={{ justifyItems: "center", marginTop: 8 }}>
        <img src="/brand/logo.svg" alt="aquiservicio" width={84} height={84} />
        <div className="fadeInUp" style={{ fontWeight: 900, fontSize: 20, letterSpacing: 1 }}>
          BIENVENIDOS
        </div>

        <div style={{ color: "var(--muted)", textAlign: "center", maxWidth: 560 }}>
          Busca <b>Comida</b>, <b>Servicios</b>, revisa <b>Marketplace</b> (en proceso) o entra al <b>Chat</b> de tu municipio.
        </div>
      </div>

      {/* municipio */}
      <section className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>Municipio</div>
        <select className="select" value={selected ?? ""} onChange={(e) => setSelected(Number(e.target.value))}>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id} disabled={m.status !== "active"}>
              {m.name} {m.status !== "active" ? "(Próximamente)" : ""}
            </option>
          ))}
        </select>
      </section>

      {/* cards */}
      <section className="grid2" style={{ marginTop: 12 }}>
        <a className="card" href={activeSelected ? "/comida" : "#"} style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Comida</div>
          <div style={{ color: "#555", marginTop: 6 }}>Abiertos ahora y recomendaciones</div>
        </a>

        <a className="card" href={activeSelected ? "/servicios" : "#"} style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Servicios</div>
          <div style={{ color: "#555", marginTop: 6 }}>Disponibles ahora y recomendaciones</div>
        </a>

        <a className="card" href={activeSelected ? "/chat" : "#"} style={{ textDecoration: "none" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Chat del municipio</div>
          <div style={{ color: "#555", marginTop: 6 }}>Publica y opina en tu comunidad</div>
        </a>

        <div className="card" style={{ opacity: 0.65 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Marketplace</div>
          <div style={{ color: "#555", marginTop: 6 }}>En proceso</div>
        </div>
      </section>

      {/* cuenta (OBLIGATORIO) */}
      <section className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Cuenta</div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <a className="btn btnPrimary" href="/login" style={{ textDecoration: "none" }}>
            Iniciar sesión
          </a>
          <div style={{ marginTop: -6, fontSize: 12, color: "var(--muted)" }}>Accede a tu cuenta</div>

          <a className="btn btnGhost" href="/registrar" style={{ textDecoration: "none" }}>
            Crear cuenta
          </a>
          <div style={{ marginTop: -6, fontSize: 12, color: "var(--muted)" }}>Regístrate rápidamente</div>
        </div>
      </section>

      {/* banner */}
      {banner && (
        <section className="card" style={{ marginTop: 12 }}>
          <a
            href={banner.link_url || "#"}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
            target={banner.link_url?.startsWith("http") ? "_blank" : undefined}
            rel={banner.link_url?.startsWith("http") ? "noreferrer" : undefined}
          >
            {banner.title && <div style={{ fontWeight: 800, marginBottom: 10 }}>{banner.title}</div>}
            <img
              src={banner.image_url}
              alt={banner.title || "banner"}
              style={{ width: "100%", borderRadius: 14, border: "1px solid var(--border)" }}
            />
          </a>
        </section>
      )}

      {/* reglas (OBLIGATORIO) */}
      <section className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>REGLAS</div>
        <div style={{ color: "#444", marginTop: 8 }}>
          Aquiservicio es para servicios, negocios locales y ayuda comunitaria útil. No es red social, no política, no noticias.
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn btnPrimary" href="/reglas" style={{ textDecoration: "none" }}>
            Ver reglas completas
          </a>
        </div>
      </section>

      {/* redes sociales (PENDIENTE, pero visible) */}
      <section className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Redes sociales</div>
        <div style={{ color: "var(--muted)", marginTop: 8, fontSize: 12 }}>
          Pendiente por configurar
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="btn btnGhost" style={{ cursor: "default", opacity: 0.8 }}>WhatsApp</div>
          <div className="btn btnGhost" style={{ cursor: "default", opacity: 0.8 }}>Instagram</div>
          <div className="btn btnGhost" style={{ cursor: "default", opacity: 0.8 }}>Facebook</div>
        </div>
      </section>

      {/* footer */}
      <div style={{ color: "#666", fontSize: 12, marginTop: 18, textAlign: "center" }}>
        aquiservicio.com · V1 · Navolato activo
      </div>
    </main>
  );
}
