import { supabase, ensureBrowserSupabaseConfigured, isBrowserSupabaseConfigured } from "../lib/supabase/client";

export { supabase };
export let isSupabaseConfigured = isBrowserSupabaseConfigured;

export const checkSupabaseConnection = async () => {
  isSupabaseConfigured = await ensureBrowserSupabaseConfigured();
  if (!isSupabaseConfigured) {
    console.warn("Supabase env missing");
    return false;
  }

  try {
    const response = await fetch("/api/health/supabase");
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      console.warn("Supabase health check failed", data.error || response.statusText);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Supabase health check failed", error);
    return false;
  }
};

export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
  return data;
};

export const updateProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) throw error;
  return data;
};
