"use client";

import { useEffect, useMemo, useState } from "react";

type Municipality = { id: number; name: string; status: "active" | "coming_soon" };
type Colony = { id: number; name: string; municipality_id: number };

const onlyDigits = (v: string) => v.replace(/\D/g, "");
const validName = (v: string) =>
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]+$/.test(v.trim());

export default function RegistrarPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);

  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [municipalityId, setMunicipalityId] = useState<number | null>(null);
  const [colonyId, setColonyId] = useState<number | null>(null);

  const [acceptRules, setAcceptRules] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isValid = useMemo(() => {
    return (
      acceptRules &&
      municipalityId &&
      colonyId &&
      onlyDigits(phone).length >= 8 &&
      onlyDigits(whatsapp).length >= 8 &&
      password.length >= 8 &&
      validName(name) &&
      validName(lastName)
    );
  }, [
    acceptRules,
    municipalityId,
    colonyId,
    phone,
    whatsapp,
    password,
    name,
    lastName,
  ]);

  useEffect(() => {
    (async () => {
      const m = await fetch("/api/public/municipalities", {
        cache: "no-store",
      }).then((r) => r.json());

      const list: Municipality[] = m?.municipalities || [];
      setMunicipalities(list);

      const active = list.find((x) => x.status === "active")?.id ?? null;
      setMunicipalityId(active);

      if (active) {
        const c = await fetch(
          `/api/public/colonies?municipality_id=${active}`,
          { cache: "no-store" }
        ).then((r) => r.json());

        const cols: Colony[] = c?.colonies || [];
        setColonies(cols);
        setColonyId(cols[0]?.id ?? null);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!municipalityId) return;

      const c = await fetch(
        `/api/public/colonies?municipality_id=${municipalityId}`,
        { cache: "no-store" }
      ).then((r) => r.json());

      const cols: Colony[] = c?.colonies || [];
      setColonies(cols);
      setColonyId(cols[0]?.id ?? null);
    })();
  }, [municipalityId]);

  async function submit() {
    setMsg(null);

    if (!isValid) return;

    setBusy(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: onlyDigits(phone),
          whatsapp_phone: onlyDigits(whatsapp),
          password,
          name: name.trim(),
          last_name: lastName.trim(),
          municipality_id: municipalityId,
          colony_id: colonyId,
          email: email.trim() || "",
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setMsg(j?.error || "No se pudo registrar.");
        return;
      }

      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Crear cuenta</h1>
      <p style={{ color: "#444" }}>
        Registro V1 (Navolato activo). Si no llega SMS, se hace validación manual.
      </p>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="grid">
          <input
            className="select"
            placeholder="Teléfono"
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value))}
          />

          <input
            className="select"
            placeholder="WhatsApp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(onlyDigits(e.target.value))}
          />

          <input
            className="select"
            type="password"
            placeholder="Contraseña (mínimo 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            className="select"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="select"
            placeholder="Apellido"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />

          <input
            className="select"
            placeholder="Email (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <div style={{ fontSize: 12, color: "#555" }}>Municipio</div>
            <select
              className="select"
              value={municipalityId ?? ""}
              onChange={(e) => setMunicipalityId(Number(e.target.value))}
            >
              {municipalities.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  disabled={m.status !== "active"}
                >
                  {m.name}{" "}
                  {m.status !== "active" ? "(Próximamente)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#555" }}>Colonia</div>
            <select
              className="select"
              value={colonyId ?? ""}
              onChange={(e) => setColonyId(Number(e.target.value))}
            >
              {colonies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", gap: 10 }}>
            <input
              type="checkbox"
              checked={acceptRules}
              onChange={(e) => setAcceptRules(e.target.checked)}
            />
            <span>
              He leído y acepto las{" "}
              <a href="/reglas">Reglas Oficiales</a>.
            </span>
          </label>

          <button
            className="btn btnPrimary"
            onClick={submit}
            disabled={!isValid || busy}
          >
            {busy ? "Creando..." : "Crear cuenta"}
          </button>

          {msg && <div style={{ color: "crimson" }}>{msg}</div>}

          <a href="/" style={{ color: "#0A1F44" }}>
            ← Volver
          </a>
        </div>
      </section>
    </main>
  );
}
