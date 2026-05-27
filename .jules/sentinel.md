## 2025-05-18 - Fix unauthenticated SSRF in NVIDIA proxy
**Vulnerability:** The Vercel serverless function `handleNvidiaProxy` exposed an endpoint that consumed the backend `NVIDIA_API_KEY` but lacked any authentication checks. This allowed unauthenticated, cross-origin abuse of the endpoint.
**Learning:** Serverless proxy routes that forward to billing-sensitive third-party APIs must always have identical authentication checks as internal RPC calls.
**Prevention:** Always wrap Vercel node function handlers in an `await requireAuthenticatedUser(req)` block before proceeding to process the request payload or secrets.
## 2025-02-24 - [CRITICAL] Fix authentication bypass backdoor
**Vulnerability:** A "Demo Admin" backdoor allowing authentication bypass existed in the production bundle via the `src/context/AuthContext.tsx` and `src/pages/Login.tsx` files.
**Learning:** Developers often add convenience buttons or mock authentication states for local testing but fail to appropriately strip them out or gate them conditionally based on the environment, inadvertently leaking elevated access capabilities to production users.
**Prevention:** Always use environment gating, such as `import.meta.env.DEV`, for mock login/auth flows. This ensures that modern bundlers (like Vite or Webpack) identify the code branch as dead code during the production build step and completely remove the logic and UI elements.
