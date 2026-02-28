import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const municipalityId = Number(url.searchParams.get("municipality_id"));
  if (!Number.isFinite(municipalityId) || municipalityId <= 0) {
    return NextResponse.json({ ok: false, error: "municipality_id inválido" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("colonies")
    .select("id,name,municipality_id")
    .eq("municipality_id", municipalityId)
    .order("name");

  if (error) return NextResponse.json({ ok: false, error: "Error cargando colonias" }, { status: 500 });
  return NextResponse.json({ ok: true, colonies: data });
}
