import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { hasUsableSupabaseKey, isValidSupabaseUrl } from "./env";

const browserSupabaseUrl =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL;

const browserSupabaseAnonKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isBrowserSupabaseConfigured =
  isValidSupabaseUrl(browserSupabaseUrl) && hasUsableSupabaseKey(browserSupabaseAnonKey);

const createUnavailableClient = () => {
  console.warn("Supabase env missing");

  const unavailable = async () => ({
    data: null,
    error: { message: "Supabase env missing" },
  });

  const chain: any = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    gt: () => chain,
    gte: () => chain,
    lt: () => chain,
    lte: () => chain,
    ilike: () => chain,
    like: () => chain,
    in: () => chain,
    contains: () => chain,
    not: () => chain,
    is: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    single: unavailable,
    maybeSingle: unavailable,
    then: (onfulfilled: any) => unavailable().then(onfulfilled),
  };

  return {
    from: () => chain,
    rpc: unavailable,
    channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }),
    removeChannel: () => {},
    auth: {
      signInWithPassword: unavailable,
      signUp: unavailable,
      signInWithOAuth: unavailable,
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    storage: { from: () => chain },
  } as any;
};

export const supabase: any = isBrowserSupabaseConfigured
  ? createClient<Database>(browserSupabaseUrl, browserSupabaseAnonKey)
  : createUnavailableClient() as any;

if (isBrowserSupabaseConfigured) {
  console.info("Supabase client initialized");
}
