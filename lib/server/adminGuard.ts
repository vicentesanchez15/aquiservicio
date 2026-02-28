import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { requireSessionUser, HttpError } from "@/lib/server/authz";

export type AdminContext = {
  user: {
    id: string;
    role: "admin" | "helper";
    account_status: string;
    municipality_id: string;
  };
  isAdmin: boolean;
  isHelper: boolean;
};

// Admin o Helper (para panel)
export async function requireAdminOrHelper(): Promise<AdminContext> {
  const u = await requireSessionUser({ rolling: true });

  if (u.role !== "admin" && u.role !== "helper") {
    throw new HttpError(403, "NOT_ADMIN");
  }

  // En admin panel sí tiene sentido bloquear si no está active
  // (si luego quieres permitir under_review a helpers, lo ajustas aquí, centralizado)
  if (u.account_status !== "active") {
    throw new HttpError(403, "ACCOUNT_NOT_ACTIVE");
  }

  return {
    user: {
      id: u.id,
      role: u.role,
      account_status: u.account_status,
      municipality_id: u.municipality_id,
    },
    isAdmin: u.role === "admin",
    isHelper: u.role === "helper",
  };
}

// Solo Admin (acciones sensibles)
export async function requireAdminOnly(): Promise<AdminContext> {
  const ctx = await requireAdminOrHelper();
  if (!ctx.isAdmin) {
    throw new HttpError(403, "HELPER_FORBIDDEN");
  }
  return ctx;
}
