## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-02-14 - Fix unauthorized abuse of API quota in aiHandlers.ts
**Vulnerability:** A missing check after calling `resolveCredentialContext()` allowed unauthenticated users to use platform AI quota when `credentialMode` was 'platform'.
**Learning:** Returning `userId: undefined` from an authentication context resolver does not automatically prevent downstream execution. Handlers must explicitly check the result and abort the flow when the check fails.
**Prevention:** For backend API endpoints using a shared credential resolver, always enforce a validation check specifically for the platform mode immediately after the context is returned.
