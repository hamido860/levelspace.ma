import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { hasUsableSupabaseKey, isValidSupabaseUrl } from "./env";

const getSupabaseUrl = () =>
  process.env.SUPABASE_URL || "";

const getSupabaseAnonKey = () =>
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const getSupabaseAdminKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

export const getServerSupabaseEnv = () => {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const serviceRoleKey = getSupabaseAdminKey();
  return {
    url,
    anonKey,
    serviceRoleKey,
    urlConfigured: isValidSupabaseUrl(url),
    anonKeyConfigured: hasUsableSupabaseKey(anonKey),
    serviceRoleConfigured: hasUsableSupabaseKey(serviceRoleKey),
  };
};

export const createServerSupabaseClient = () => {
  const env = getServerSupabaseEnv();
  if (!env.urlConfigured || !env.anonKeyConfigured) {
    console.warn("Supabase env missing");
    throw new Error("Supabase env missing");
  }

  console.info("Supabase client initialized");
  return createClient<Database>(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
