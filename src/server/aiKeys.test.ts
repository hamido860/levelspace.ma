import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptApiKey,
  encryptApiKey,
  normalizeUserAiProvider,
  toSafeMetadata,
} from "./aiKeys";

test("encrypts and decrypts API keys without hashing away the original", () => {
  const previousSecret = process.env.AI_KEYS_ENCRYPTION_SECRET;
  process.env.AI_KEYS_ENCRYPTION_SECRET = "test-secret-with-at-least-thirty-two-characters";

  try {
    const encrypted = encryptApiKey("sk-test-1234567890");
    assert.notEqual(encrypted, "sk-test-1234567890");
    assert.equal(decryptApiKey(encrypted), "sk-test-1234567890");
  } finally {
    if (previousSecret === undefined) {
      delete process.env.AI_KEYS_ENCRYPTION_SECRET;
    } else {
      process.env.AI_KEYS_ENCRYPTION_SECRET = previousSecret;
    }
  }
});

test("safe metadata never includes encrypted_api_key", () => {
  const metadata = toSafeMetadata({
    provider: "gemini",
    encrypted_api_key: "v1:secret",
    key_last4: "7890",
    is_active: true,
    updated_at: "2026-05-13T00:00:00.000Z",
  });

  assert.deepEqual(Object.keys(metadata).sort(), [
    "configured",
    "isActive",
    "keyLast4",
    "provider",
    "updatedAt",
  ]);
  assert.equal(metadata.configured, true);
  assert.equal(metadata.keyLast4, "7890");
});

test("provider validation accepts only supported BYOK providers", () => {
  assert.equal(normalizeUserAiProvider("gemini"), "gemini");
  assert.equal(normalizeUserAiProvider("openrouter"), "openrouter");
  assert.equal(normalizeUserAiProvider("openai"), "openai");
  assert.equal(normalizeUserAiProvider("nvidia"), null);
});
