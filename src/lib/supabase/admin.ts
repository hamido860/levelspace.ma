import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { getServerSupabaseEnv } from "./server";

export const createSupabaseAdminClient = () => {
  const env = getServerSupabaseEnv();
  if (!env.urlConfigured || !env.serviceRoleConfigured) {
    console.warn("Supabase env missing");
    throw new Error("Supabase admin env missing");
  }

  console.info("Supabase client initialized");
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
