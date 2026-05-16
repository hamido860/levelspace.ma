export const isValidSupabaseUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const hasUsableSupabaseKey = (key: string | undefined) =>
  Boolean(key && key.trim() && key !== "YOUR_SUPABASE_ANON_KEY" && key !== "your-anon-key");
