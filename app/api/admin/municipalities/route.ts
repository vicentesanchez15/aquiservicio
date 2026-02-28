import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { requireAdminOnly } from "@/lib/server/adminGuard";
import { getClientIp, getUA } from "@/lib/server/http";

export async function GET() {
  try {
    await requireAdminOnly();

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("municipalities")
      .select("id,name,status,allow_registration,sort_order,created_at,updated_at")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: "MUNICIPALITIES_LIST_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, municipalities: data ?? [] }, { status: 200 });
  } catch (e: any) {
    const status = e?.status || 500;
    const code = e?.code || "UNKNOWN";
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  status: z.enum(["active", "coming_soon", "disabled"]),
  allow_registration: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireAdminOnly();
    const db = supabaseAdmin();

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const payload = {
      name: parsed.data.name,
      status: parsed.data.status,
      allow_registration: parsed.data.allow_registration ?? false,
      sort_order: parsed.data.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from("municipalities")
      .insert(payload)
      .select("id,name,status,allow_registration,sort_order")
      .single();

    if (error) {
      const msg = error.message?.toLowerCase().includes("duplicate")
        ? "MUNICIPALITY_DUPLICATE"
        : "MUNICIPALITY_CREATE_FAILED";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    // Auditoría mínima
    const ip = await getClientIp();
    const { ua } = await getUA();

    await db.from("admin_audit_logs").insert({
      admin_user_id: ctx.user.id,
      action: "municipality_create",
      entity_type: "municipalities",
      entity_id: data.id,
      before_json: null,
      after_json: data,
      ip,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true, municipality: data }, { status: 200 });
  } catch (e: any) {
    const status = e?.status || 500;
    const code = e?.code || "UNKNOWN";
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
