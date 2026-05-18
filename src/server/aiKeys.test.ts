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
    key_preview: "sk-...7890",
    is_active: true,
    last_test_status: "success",
    last_tested_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
  });

  assert.deepEqual(Object.keys(metadata).sort(), [
    "is_active",
    "key_preview",
    "last_test_status",
    "last_tested_at",
    "provider",
    "updated_at",
  ]);
  assert.equal(metadata.key_preview, "sk-...7890");
  assert.equal(metadata.is_active, true);
});

test("provider validation accepts only supported BYOK providers", () => {
  assert.equal(normalizeUserAiProvider("gemini"), "gemini");
  assert.equal(normalizeUserAiProvider("openrouter"), "openrouter");
  assert.equal(normalizeUserAiProvider("openai"), "openai");
  assert.equal(normalizeUserAiProvider("nvidia"), null);
});
