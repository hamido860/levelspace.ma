## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.

## 2024-05-27 - [Server-Side Request Forgery & Unauthenticated Resource Exhaustion]
**Vulnerability:** AI generation endpoints in `src/server/api/aiHandlers.ts` did not verify if an anonymous user making a request with the "platform" credential mode actually possessed a valid session (`userId`).
**Learning:** Downstream authentication contexts (like `resolveCredentialContext`) only returned `{ credentialMode: 'platform', userId: undefined }` without throwing errors directly, leaving it to the specific route handler to enforce authentication by explicitly checking and returning a 401 error. Missing this check allows an unauthenticated user to consume AI platform credits and bypass authorization policies.
**Prevention:** Always verify `if (credentials.credentialMode === 'platform' && !credentials.userId)` immediately after resolving credentials in route handlers and return a 401 response if true to ensure platform resources are not exhausted by unauthorized requests.
