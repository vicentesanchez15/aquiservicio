"use client";

import { useMemo, useState } from "react";

const onlyDigits = (v: string) => v.replace(/\D/g, "");

type MeResp =
  | { ok: true; user: null }
  | {
      ok: true;
      user: {
        id: number;
        phone: string;
        account_status:
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
        role: "user" | "admin" | "helper";
        premium_status?: "none" | "active";
        premium_expires_at?: string | null;
      };
    };

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return onlyDigits(phone).length >= 8 && password.length >= 8;
  }, [phone, password]);

  async function submit() {
    setMsg(null);
    if (!canSubmit || busy) return;

    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: onlyDigits(phone), password }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error || "No se pudo iniciar sesión.");
        return;
      }

      // Confirmar estado con /api/auth/me (cookie httpOnly)
      const me = (await fetch("/api/auth/me", { cache: "no-store" }).then((x) =>
        x.json()
      )) as MeResp;

      const u = (me as any)?.user;
      if (!u) {
        setMsg("No se pudo validar la sesión.");
        return;
      }

      if (u.account_status === "active") {
        window.location.href = "/perfil";
        return;
      }

      if (u.account_status === "pending_manual_validation") {
        window.location.href = "/perfil?tab=pendiente";
        return;
      }

      // Cualquier estado restringido → perfil estado
      window.location.href = "/perfil?tab=estado";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div style={{ display: "grid", justifyItems: "center", marginTop: 8 }}>
        <img src="/brand/logo.svg" alt="aquiservicio" width={70} height={70} />
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, marginTop: 10 }}>
        Iniciar sesión
      </h1>
      <p style={{ color: "#444" }}>
        Accede a tu cuenta para opinar, usar el chat y guardar favoritos.
      </p>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="grid">
          <input
            className="select"
            placeholder="Teléfono"
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value))}
            inputMode="numeric"
          />

          <input
            className="select"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="btn btnPrimary"
            onClick={submit}
            disabled={!canSubmit || busy}
          >
            {busy ? "Entrando..." : "Entrar"}
          </button>

          {msg && <div style={{ color: "crimson" }}>{msg}</div>}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <a href="/registrar" style={{ color: "#0A1F44" }}>
              Crear cuenta
            </a>
            <a href="/" style={{ color: "#0A1F44" }}>
              ← Volver
            </a>
          </div>

          <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
            * Recuperación de contraseña queda para después.
          </div>
        </div>
      </section>
    </main>
  );
}
