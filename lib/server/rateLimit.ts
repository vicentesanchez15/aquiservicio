import { supabaseAdmin } from "./supabaseAdmin";

export async function hitRateLimit(params: {
  key: string;
  windowSeconds: number;
  maxHits: number;
}) {
  const sb = supabaseAdmin();

  const { data, error } = await sb.rpc("hit_rate_limit_atomic", {
    p_key: params.key,
    p_window_seconds: params.windowSeconds,
    p_max_hits: params.maxHits,
  });

  if (error) throw error;

  // supabase rpc regresa array
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("RATE_LIMIT_RPC_EMPTY");

  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    // extra útil para debug (opcional)
    hits: Number(row.hits ?? 0),
    resetAt: row.reset_at as string,
  };
}
