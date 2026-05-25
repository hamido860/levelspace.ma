1. **Identify the vulnerability:** The `/api/nvidia-proxy` endpoint in `api/[...slug].ts` is an unauthenticated serverless function that proxies requests to the NVIDIA API using the server's configured `NVIDIA_API_KEY`. This is a Server-Side Request Forgery (SSRF) and abuse vulnerability because any malicious user can directly call this endpoint to consume the application's NVIDIA API quota without being authenticated.

2. **Understand the mitigation:** From the memory provided: "To secure serverless API proxy endpoints (like `/api/nvidia-proxy` in `api/[...slug].ts`) against unauthenticated abuse (SSRF), use the exported `requireAuthenticatedUser(req)` utility from `src/server/api/aiCommandCenter.ts`."

3. **Modify `api/[...slug].ts`:**
    * Import `requireAuthenticatedUser` from `../src/server/api/aiCommandCenter`.
    * In the `handleNvidiaProxy` function, await `requireAuthenticatedUser(req)` before making the proxy request to NVIDIA.
    * Wrap the call in a `try...catch` block to handle authentication failures gracefully (if it isn't already handled properly by the function throwing).
    * If an unauthenticated user attempts to access the endpoint, `requireAuthenticatedUser(req)` will throw an `AiCommandCenterHttpError`, which needs to be caught and returned, or we can just let `try...catch` catch it and use `sendError`.

4. **Verify changes:**
    * Check `pnpm format`, `pnpm lint`.
    * Run test suite if applicable.

5. **Commit the fix:**
    * "🛡️ Sentinel: [CRITICAL] Fix unauthenticated NVIDIA proxy SSRF"
