import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("municipalities")
    .select("id,name,status")
    .order("id");

  if (error) return NextResponse.json({ ok: false, error: "Error cargando municipios" }, { status: 500 });
  return NextResponse.json({ ok: true, municipalities: data });
}
