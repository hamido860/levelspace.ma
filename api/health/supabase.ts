import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createServerSupabaseClient, getServerSupabaseEnv } from "../../src/lib/supabase/server";
import { createSupabaseAdminClient } from "../../src/lib/supabase/admin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const env = getServerSupabaseEnv();
  const base = {
    urlConfigured: env.urlConfigured,
    anonKeyConfigured: env.anonKeyConfigured,
    serviceRoleConfigured: env.serviceRoleConfigured,
  };

  if (!env.urlConfigured || !env.anonKeyConfigured) {
    console.warn("Supabase env missing");
    return res.status(503).json({
      ok: false,
      ...base,
      error: "Supabase env missing",
    });
  }

  try {
    const supabase = env.serviceRoleConfigured
      ? createSupabaseAdminClient()
      : createServerSupabaseClient();

    const { error } = await supabase
      .from("curricula")
      .select("id")
      .limit(1);

    if (error) {
      console.warn("Supabase health check failed", error.message);
      return res.status(503).json({
        ok: false,
        ...base,
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      ...base,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase health check failed";
    console.warn("Supabase health check failed", message);
    return res.status(503).json({
      ok: false,
      ...base,
      error: message,
    });
  }
}
