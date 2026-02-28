import { headers } from "next/headers";

export async function getClientIp() {
  const h = await headers();

  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  return h.get("x-real-ip") || "0.0.0.0";
}

export async function getUA() {
  const h = await headers();
  return {
    ua: h.get("user-agent") || "",
    lang: h.get("accept-language") || "",
  };
}
