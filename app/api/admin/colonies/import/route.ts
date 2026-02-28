import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { requireAdmin, requireAdminKey } from "@/lib/server/adminGuard";

const schema = z.object({
  municipality_id: z.number().int().positive(),
  text: z.string().min(1).max(20000),
});

function normalizeLines(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // quitar duplicadas preservando orden
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(l);
    }
  }
  return out;
}

export async function POST(req: Request) {
  const k = requireAdminKey(req);
  if (!k.ok) return NextResponse.json({ ok: false, error: k.error }, { status: k.status });

  const a = await requireAdmin();
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });

  const names = normalizeLines(parsed.data.text);
  if (names.length === 0) return NextResponse.json({ ok: false, error: "No hay colonias" }, { status: 400 });
  if (names.length > 5000) return NextResponse.json({ ok: false, error: "Máximo 5000 por import" }, { status: 400 });

  const db = supabaseAdmin();

  const rows = names.map((name) => ({
    municipality_id: parsed.data.municipality_id,
    name,
  }));

  // upsert por (municipality_id, name) gracias al unique
  const { data, error } = await db
    .from("colonies")
    .upsert(rows, { onConflict: "municipality_id,name", ignoreDuplicates: true })
    .select("id");

  if (error) return NextResponse.json({ ok: false, error: "Error importando colonias" }, { status: 500 });

  return NextResponse.json({ ok: true, inserted_or_kept: data?.length ?? 0, total_lines: names.length });
}
