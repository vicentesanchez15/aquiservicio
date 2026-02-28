import { NextResponse } from "next/server";
import { requireSessionUser, HttpError } from "@/lib/server/authz";

export async function GET() {
  try {
    // /me sí conviene que haga rolling (mantener sesión viva)
    const user = await requireSessionUser({ rolling: true });
    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch (e: any) {
    if (e instanceof HttpError) {
      // Importante: /me para UI debe regresar user:null en 200 cuando no hay sesión
      if (e.code === "NO_SESSION" || e.code === "SESSION_NOT_FOUND" || e.code === "SESSION_EXPIRED" || e.code === "SESSION_REVOKED") {
        return NextResponse.json({ ok: true, user: null }, { status: 200 });
      }
      return NextResponse.json({ ok: false, error: e.code }, { status: e.status });
    }
    return NextResponse.json({ ok: false, error: "UNKNOWN" }, { status: 500 });
  }
}
