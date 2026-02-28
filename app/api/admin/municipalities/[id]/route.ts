import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { requireAdminOnly } from "@/lib/server/adminGuard";
import { getClientIp, getUA } from "@/lib/server/http";

// PATCH schema
const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  status: z.enum(["active", "coming_soon", "disabled"]).optional(),
  allow_registration: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// DELETE schema (soft delete)
const deleteSchema = z.object({
  reason: z.string().min(2).max(200).optional(),
});

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminOnly();
    const { id } = await ctx.params;

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("municipalities")
      .select("id,name,status,allow_registration,sort_order,created_at,updated_at,deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: "MUNICIPALITY_GET_FAILED" }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({ ok: true, municipality: data }, { status: 200 });
  } catch (e: any) {
    const status = e?.status || 500;
    const code = e?.code || "UNKNOWN";
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminOnly();
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const db = supabaseAdmin();

    // before
    const { data: before, error: bErr } = await db
      .from("municipalities")
      .select("id,name,status,allow_registration,sort_order,deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (bErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
    if (!before) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (before.deleted_at) return NextResponse.json({ ok: false, error: "ALREADY_DELETED" }, { status: 409 });

    const patch: any = { updated_at: new Date().toISOString() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.allow_registration !== undefined) patch.allow_registration = parsed.data.allow_registration;
    if (parsed.data.sort_order !== undefined) patch.sort_order = parsed.data.sort_order;

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json({ ok: false, error: "NO_CHANGES" }, { status: 400 });
    }

    const { data: after, error: upErr } = await db
      .from("municipalities")
      .update(patch)
      .eq("id", id)
      .select("id,name,status,allow_registration,sort_order,updated_at")
      .single();

    if (upErr) {
      const msg = upErr.message?.toLowerCase().includes("duplicate")
        ? "MUNICIPALITY_DUPLICATE"
        : "MUNICIPALITY_UPDATE_FAILED";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    // audit
    const ip = await getClientIp();
    const { ua } = await getUA();
    await db.from("admin_audit_logs").insert({
      admin_user_id: admin.user.id,
      action: "municipality_update",
      entity_type: "municipalities",
      entity_id: id,
      before_json: before,
      after_json: after,
      ip,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true, municipality: after }, { status: 200 });
  } catch (e: any) {
    const status = e?.status || 500;
    const code = e?.code || "UNKNOWN";
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminOnly();
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const db = supabaseAdmin();

    // before
    const { data: before, error: bErr } = await db
      .from("municipalities")
      .select("id,name,status,allow_registration,sort_order,deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (bErr) return NextResponse.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
    if (!before) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (before.deleted_at) return NextResponse.json({ ok: false, error: "ALREADY_DELETED" }, { status: 409 });

    const now = new Date().toISOString();

    const { data: after, error: delErr } = await db
      .from("municipalities")
      .update({ deleted_at: now, updated_at: now })
      .eq("id", id)
      .select("id,name,status,allow_registration,sort_order,deleted_at")
      .single();

    if (delErr) return NextResponse.json({ ok: false, error: "MUNICIPALITY_DELETE_FAILED" }, { status: 500 });

    // audit
    const ip = await getClientIp();
    const { ua } = await getUA();
    await db.from("admin_audit_logs").insert({
      admin_user_id: admin.user.id,
      action: "municipality_delete",
      entity_type: "municipalities",
      entity_id: id,
      before_json: before,
      after_json: { ...after, reason: parsed.data.reason || null },
      ip,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const status = e?.status || 500;
    const code = e?.code || "UNKNOWN";
    return NextResponse.json({ ok: false, error: code }, { status });
  }
}
