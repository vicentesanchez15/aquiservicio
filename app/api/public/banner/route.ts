import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function GET() {
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();

  // 1) Traer 1 banner activo por prioridad/ventana (según tu doc)
  const { data: banner, error } = await sb
    .from("banners")
    .select("id,image_path,link_url,priority,starts_at,ends_at")
    .is("deleted_at", null)
    .eq("enabled", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Importante: en público, mejor no explotar con mensaje “humano”,
    // regresa error code consistente
    return NextResponse.json({ ok: false, error: "BANNER_QUERY_FAILED" }, { status: 500 });
  }

  if (!banner) {
    return NextResponse.json({ ok: true, banner: null }, { status: 200 });
  }

  // 2) Generar URL en /api (tu regla)
  // Intento 1: signed (sirve si el bucket es privado)
  let image_url: string | null = null;

  try {
    const signed = await sb.storage
      .from("banners")
      .createSignedUrl(banner.image_path, 60 * 60); // 1h

    image_url = signed.data?.signedUrl ?? null;
  } catch {
    image_url = null;
  }

  // Intento 2: public url (sirve si el bucket es público)
  if (!image_url) {
    try {
      const pub = sb.storage.from("banners").getPublicUrl(banner.image_path);
      image_url = pub.data?.publicUrl ?? null;
    } catch {
      image_url = null;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      banner: {
        id: banner.id,
        link_url: banner.link_url,
        priority: banner.priority,
        starts_at: banner.starts_at,
        ends_at: banner.ends_at,
        image_path: banner.image_path,
        image_url, // puede ser null si el bucket está mal configurado
      },
    },
    { status: 200 }
  );
}
