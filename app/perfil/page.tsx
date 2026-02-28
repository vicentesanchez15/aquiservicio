"use client";

import { useEffect, useMemo, useState } from "react";

type AccountStatus =
  | "active"
  | "pending_manual_validation"
  | "manual_expired"
  | "under_review"
  | "limited"
  | "suspended"
  | "banned"
  | "shadowbanned"
  | "inactive_temp"
  | "pending_deletion";

type MeResp =
  | { ok: true; user: null }
  | {
      ok: true;
      user: {
        id: number;
        phone: string;
        account_status: AccountStatus;
        role: "user" | "admin" | "helper";
        premium_status?: "none" | "active";
        premium_expires_at?: string | null;
      };
    };

function getTabFromUrl() {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  return sp.get("tab");
}

export default function PerfilPage() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const tab = useMemo(() => getTabFromUrl(), []);

  useEffect(() => {
    (async () => {
      const j = (await fetch("/api/auth/me", { cache: "no-store" }).then((r) =>
        r.json()
      )) as MeResp;
      setMe(j);
    })();
  }, []);

  const user = (me as any)?.user ?? null;

  async function logout() {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (r.ok) window.location.href = "/";
      else setMsg("No se pudo cerrar sesión.");
    } finally {
      setBusy(false);
    }
  }

  // No logeado
  if (!me) {
    return (
      <main className="container">
        <div className="card" style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900 }}>Cargando…</div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container">
        <div className="card" style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>No hay sesión</div>
          <div style={{ color: "#444", marginTop: 6 }}>
            Inicia sesión para ver tu perfil.
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <a className="btn btnPrimary" href="/login" style={{ textDecoration: "none" }}>
              Iniciar sesión
            </a>
            <a className="btn btnGhost" href="/registrar" style={{ textDecoration: "none" }}>
              Crear cuenta
            </a>
          </div>
        </div>
      </main>
    );
  }

  const isPending = user.account_status === "pending_manual_validation";
  const isRestricted =
    user.account_status !== "active" && user.account_status !== "pending_manual_validation";

  return (
    <main className="container">
      <div style={{ display: "grid", justifyItems: "center", marginTop: 8 }}>
        <img src="/brand/logo.svg" alt="aquiservicio" width={70} height={70} />
      </div>

      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Mi perfil</div>
          <div style={{ color: "#444", fontSize: 13 }}>
            {user.phone} · {user.role.toUpperCase()} · {user.account_status}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user.role === "admin" && (
            <a className="btn btnGhost" href="/admin" style={{ textDecoration: "none" }}>
              Admin
            </a>
          )}
          <button className="btn btnPrimary" onClick={logout} disabled={busy}>
            {busy ? "..." : "Cerrar sesión"}
          </button>
        </div>
      </div>

      {/* PANEL PENDIENTE */}
      {isPending && (
        <section className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Pendiente de validación manual</div>
          <div style={{ color: "#444", marginTop: 8 }}>
            Tu cuenta está en revisión porque no se pudo completar el SMS.
            El admin te enviará un código por WhatsApp o llamada.
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>
              Código manual (próximo paso)
            </div>
            <input className="select" placeholder="Ingresa el código de 6 dígitos" disabled />
            <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
              * En el siguiente paso haremos el endpoint + UI para capturar y validar este código.
            </div>
          </div>
        </section>
      )}

      {/* PANEL RESTRINGIDO */}
      {isRestricted && (
        <section className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Acceso limitado</div>
          <div style={{ color: "#444", marginTop: 8 }}>
            Tu cuenta está en estado: <b>{user.account_status}</b>.  
            En este estado no puedes usar chat ni ver perfiles.
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <a className="btn btnGhost" href="/" style={{ textDecoration: "none" }}>
              Ir al inicio
            </a>
            <a className="btn btnGhost" href="/comida" style={{ textDecoration: "none" }}>
              Ver comida
            </a>
            <a className="btn btnGhost" href="/servicios" style={{ textDecoration: "none" }}>
              Ver servicios
            </a>
          </div>
        </section>
      )}

      {/* PANEL ACTIVO */}
      {user.account_status === "active" && (
        <section className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Tu cuenta está activa ✅</div>
          <div style={{ color: "#444", marginTop: 8 }}>
            Ya puedes opinar, usar el chat y guardar favoritos.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <a className="btn btnPrimary" href="/chat" style={{ textDecoration: "none" }}>
              Entrar al chat
            </a>
            <div style={{ display: "flex", gap: 10 }}>
              <a className="btn btnGhost" href="/comida" style={{ textDecoration: "none", flex: 1 }}>
                Comida
              </a>
              <a className="btn btnGhost" href="/servicios" style={{ textDecoration: "none", flex: 1 }}>
                Servicios
              </a>
            </div>

            <div style={{ color: "#666", fontSize: 12 }}>
              Premium: {user.premium_status ?? "none"}
              {user.premium_expires_at ? ` · vence: ${user.premium_expires_at}` : ""}
            </div>
          </div>
        </section>
      )}

      {msg && (
        <section className="card" style={{ marginTop: 12 }}>
          <div style={{ color: "crimson" }}>{msg}</div>
        </section>
      )}

      <div style={{ color: "#666", fontSize: 12, marginTop: 18, textAlign: "center" }}>
        aquiservicio.com · V1
      </div>
    </main>
  );
}
