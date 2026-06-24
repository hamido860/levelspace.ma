## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-05-18 - Fix missing authentication checks for platform AI routes
**Vulnerability:** The AI generation handlers (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) and `handleAIEmbed` allowed unauthenticated users to use backend credentials because there was no validation that `userId` existed when `credentialMode` resolved to `'platform'`. This allowed for an unauthenticated SSRF and platform billing exhaustion.
**Learning:** `resolveCredentialContext` returns state (whether credentials are 'byok' or 'platform', and whether `userId` exists), but does not throw errors on its own. Specific downstream routes must explicitly enforce the authentication state they require.
**Prevention:** Always verify that `userId` exists when relying on `platform` credentials in AI generation routes.
