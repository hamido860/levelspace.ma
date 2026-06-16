import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getServerSupabaseEnv } from "../src/lib/supabase/server";

export default function handleSupabasePublicConfig(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const env = getServerSupabaseEnv();
  return res.status(200).json({
    configured: env.urlConfigured && env.anonKeyConfigured,
    url: env.urlConfigured ? env.url : null,
    anonKey: env.anonKeyConfigured ? env.anonKey : null,
  });
}
