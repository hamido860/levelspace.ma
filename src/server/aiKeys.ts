import crypto from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { AiCommandCenterHttpError, requireAuthenticatedUser } from "./api/aiCommandCenter";
import { isDevAdminAiKeyModeEnabled } from "../lib/envDiagnostics";

export const USER_AI_KEY_PROVIDERS = ["gemini", "openrouter", "openai", "nvidia"] as const;
export type UserAiKeyProvider = (typeof USER_AI_KEY_PROVIDERS)[number];

export type UserAiKeyMetadata = {
  provider: UserAiKeyProvider;
  key_preview: string | null;
  is_active: boolean;
  last_test_status: string | null;
  last_tested_at: string | null;
  updated_at: string | null;
};

type AiProviderKeyRow = {
  provider: UserAiKeyProvider;
  encrypted_api_key?: string | null;
  key_preview: string | null;
  is_active: boolean | null;
  last_test_status: string | null;
  last_tested_at: string | null;
  updated_at: string | null;
};

export type AiKeyOwner = {
  userId: string | null;
  ownerRef: string;
  authenticated: boolean;
  devFallback: boolean;
  user: User | null;
};

const ENCRYPTION_ERROR = "AI key encryption is not configured.";
const AUTH_REQUIRED_ERROR = "Authentication required.";

const isProductionLike = () => process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

const getBearerToken = (req: VercelRequest) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  return header.match(/^Bearer\s+(.+)$/i)?.[1] || null;
};

export const getDevAdminOwnerRef = () => process.env.DEV_ADMIN_OWNER_REF || "dev-admin";

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

export function keyPreview(rawKey: string) {
  const cleaned = rawKey.trim();
  const suffix = cleaned.slice(-4);
  const prefix = cleaned.startsWith("sk-") ? "sk-" : cleaned.slice(0, Math.min(4, cleaned.length));
  return `${prefix}...${suffix || "****"}`;
}

export function toSafeMetadata(row: Partial<AiProviderKeyRow>): UserAiKeyMetadata {
  return {
    provider: row.provider as UserAiKeyProvider,
    key_preview: row.key_preview || null,
    is_active: row.is_active !== false,
    last_test_status: row.last_test_status || null,
    last_tested_at: row.last_tested_at || null,
    updated_at: row.updated_at || null,
  };
}

export async function resolveAiKeyOwner(req: VercelRequest, options: { requireAuthInProduction?: boolean } = {}): Promise<AiKeyOwner> {
  if (getBearerToken(req)) {
    const user = await requireAuthenticatedUser(req);
    return {
      user,
      userId: user.id,
      ownerRef: `user:${user.id}`,
      authenticated: true,
      devFallback: false,
    };
  }

  if (isProductionLike() && options.requireAuthInProduction !== false) {
    throw new AiCommandCenterHttpError(401, AUTH_REQUIRED_ERROR);
  }

  // TODO(auth): remove dev/admin key exception after authenticated per-user key ownership is implemented.
  // TODO(security): review key storage before production.
  if (!isDevAdminAiKeyModeEnabled()) {
    throw new AiCommandCenterHttpError(401, "Dev/admin key mode is disabled.");
  }

  return {
    user: null,
    userId: null,
    ownerRef: getDevAdminOwnerRef(),
    authenticated: false,
    devFallback: true,
  };
}

export async function listUserAiKeyMetadata(supabase: SupabaseClient, ownerRef: string) {
  const { data, error } = await supabase
    .from("ai_provider_keys")
    .select("provider, key_preview, is_active, last_test_status, last_tested_at, updated_at")
    .eq("owner_ref", ownerRef)
    .in("provider", [...USER_AI_KEY_PROVIDERS]);

  if (error) throw new Error(`Unable to load saved AI keys: ${error.message}`);

  return (data || []).map((row: any) => toSafeMetadata(row));
}

export async function upsertUserAiKey(
  supabase: SupabaseClient,
  owner: AiKeyOwner,
  provider: UserAiKeyProvider,
  rawKey: string,
) {
  const cleanedKey = rawKey.trim();
  if (!cleanedKey) throw new Error("API key is required.");

  const { data, error } = await supabase
    .from("ai_provider_keys")
    .upsert(
      {
        user_id: owner.userId,
        owner_ref: owner.ownerRef,
        provider,
        encrypted_api_key: encryptApiKey(cleanedKey),
        key_preview: keyPreview(cleanedKey),
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_ref,provider" },
    )
    .select("provider, key_preview, is_active, last_test_status, last_tested_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to save AI key.");
  return toSafeMetadata(data as any);
}

export async function deleteUserAiKey(
  supabase: SupabaseClient,
  ownerRef: string,
  provider: UserAiKeyProvider,
) {
  const { error } = await supabase
    .from("ai_provider_keys")
    .delete()
    .eq("owner_ref", ownerRef)
    .eq("provider", provider);

  if (error) throw new Error(`Unable to delete AI key: ${error.message}`);
}

export async function getDecryptedUserAiKey(
  supabase: SupabaseClient,
  ownerRef: string,
  provider: UserAiKeyProvider,
) {
  const { data, error } = await supabase
    .from("ai_provider_keys")
    .select("encrypted_api_key, is_active")
    .eq("owner_ref", ownerRef)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Unable to load saved AI key: ${error.message}`);
  if (!data?.encrypted_api_key) return null;
  return decryptApiKey(String(data.encrypted_api_key));
}

export async function updateUserAiKeyTestStatus(
  supabase: SupabaseClient,
  ownerRef: string,
  provider: UserAiKeyProvider,
  status: "passed" | "failed",
) {
  const { error } = await supabase
    .from("ai_provider_keys")
    .update({
      last_test_status: status,
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("owner_ref", ownerRef)
    .eq("provider", provider);

  if (error) throw new Error(`Unable to update AI key test status: ${error.message}`);
}
