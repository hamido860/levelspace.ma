## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2025-05-18 - Prevent Unauthenticated AI Resource Exhaustion (SSRF)
**Vulnerability:** The AI handlers in `aiHandlers.ts` failed to enforce authentication when using platform credentials, allowing unauthenticated users to consume AI credits and potentially perform Server-Side Request Forgery.
**Learning:** Context resolvers must evaluate credentials, and route handlers must explicitly verify those credentials before proceeding, especially when platform resources are consumed.
**Prevention:** Always verify `if (credentials.credentialMode === 'platform' && !credentials.userId)` and return a 401 Unauthorized response in the downstream route handlers.
