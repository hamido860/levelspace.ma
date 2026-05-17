import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const USER_AI_KEY_PROVIDERS = ["gemini", "nvidia", "openrouter", "openai"] as const;
export type UserAiKeyProvider = (typeof USER_AI_KEY_PROVIDERS)[number];

export type UserAiKeyMetadata = {
  provider: UserAiKeyProvider;
  configured: boolean;
  keyLast4: string | null;
  isActive: boolean;
  updatedAt: string | null;
};

type UserAiKeyRow = {
  provider: UserAiKeyProvider;
  encrypted_api_key: string;
  key_last4: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

const ENCRYPTION_ERROR = "AI key encryption is not configured.";

export function normalizeUserAiProvider(value: unknown): UserAiKeyProvider | null {
  const provider = String(value || "").toLowerCase();
  return USER_AI_KEY_PROVIDERS.includes(provider as UserAiKeyProvider)
    ? (provider as UserAiKeyProvider)
    : null;
}

export function requireEncryptionSecret() {
  const secret = process.env.AI_KEYS_ENCRYPTION_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(ENCRYPTION_ERROR);
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApiKey(rawKey: string) {
  const key = requireEncryptionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptApiKey(payload: string) {
  const [version, iv, authTag, encrypted] = payload.split(":");
  if (version !== "v1" || !iv || !authTag || !encrypted) {
    throw new Error("Stored AI key payload is invalid.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    requireEncryptionSecret(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function keyLast4(rawKey: string) {
  return rawKey.trim().slice(-4);
}

export function toSafeMetadata(row: Partial<UserAiKeyRow>): UserAiKeyMetadata {
  return {
    provider: row.provider as UserAiKeyProvider,
    configured: Boolean(row.encrypted_api_key),
    keyLast4: row.key_last4 || null,
    isActive: row.is_active !== false,
    updatedAt: row.updated_at || null,
  };
}

export async function listUserAiKeyMetadata(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_ai_keys")
    .select("provider, key_last4, is_active, updated_at")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const byProvider = new Map(
    (data || []).map((row: any) => [
      row.provider,
      toSafeMetadata({ ...row, encrypted_api_key: "configured" }),
    ]),
  );

  return USER_AI_KEY_PROVIDERS.map((provider) =>
    byProvider.get(provider) || {
      provider,
      configured: false,
      keyLast4: null,
      isActive: false,
      updatedAt: null,
    },
  );
}

export async function upsertUserAiKey(
  supabase: SupabaseClient,
  userId: string,
  provider: UserAiKeyProvider,
  rawKey: string,
  label?: string | null,
) {
  const cleanedKey = rawKey.trim();
  const { data, error } = await supabase
    .from("user_ai_keys")
    .upsert(
      {
        user_id: userId,
        provider,
        encrypted_api_key: encryptApiKey(cleanedKey),
        key_last4: keyLast4(cleanedKey),
        label: label || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    )
    .select("provider, key_last4, is_active, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to save AI key.");
  return toSafeMetadata({ ...(data as any), encrypted_api_key: "configured" });
}

export async function deleteUserAiKey(
  supabase: SupabaseClient,
  userId: string,
  provider: UserAiKeyProvider,
) {
  const { error } = await supabase
    .from("user_ai_keys")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) throw new Error(error.message);
}

export async function getDecryptedUserAiKey(
  supabase: SupabaseClient,
  userId: string,
  provider: UserAiKeyProvider,
) {
  const { data, error } = await supabase
    .from("user_ai_keys")
    .select("encrypted_api_key, is_active")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.encrypted_api_key) return null;
  return decryptApiKey(String(data.encrypted_api_key));
}
