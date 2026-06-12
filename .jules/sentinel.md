## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-05-18 - Fix unauthenticated platform AI credit usage
**Vulnerability:** The Vercel serverless functions in `src/server/api/aiHandlers.ts` (`handleAIGenerate`, `handleAIExplain`, `handleAILessonBlocks`) resolved credentials for platform AI credits but failed to explicitly check if a user was authenticated before processing the request. This allowed unauthenticated actors to consume platform credits and potentially exploit SSRF if no fallback `requireAuthenticatedUser` checks were present.
**Learning:** Context resolvers (like `resolveCredentialContext`) only evaluate state (e.g., `userId: undefined`) and do not enforce authorization by throwing errors. It is the responsibility of the specific downstream route handlers to check the resolved credentials and return HTTP 401 Unauthorized errors if authentication is required but missing.
**Prevention:** Always verify authentication explicitly (`if (credentials.credentialMode === 'platform' && !credentials.userId) { return res.status(401)... }`) immediately after resolving credentials if the operation requires a logged-in user.
