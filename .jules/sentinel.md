## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-05-20 - Unenforced Authentication in Context Resolvers
**Vulnerability:** Platform AI credit exhaustion (SSRF risk) via unauthenticated access. AI route handlers called `resolveCredentialContext()` which only returned state (`userId: undefined`), but the downstream handlers failed to explicitly evaluate this state and reject the requests.
**Learning:** In this backend architecture, context resolvers (like `resolveCredentialContext`) do not throw HTTP errors or enforce security boundaries on their own. They simply evaluate the environment/request and return a state object.
**Prevention:** Always ensure that downstream route handlers explicitly evaluate the state returned by context resolvers and return HTTP 401 Unauthorized errors when required conditions (like `!credentials.userId` for platform usage) are not met.
