
## 2026-05-10 - Secure Unauthenticated NVIDIA Proxy Endpoint
**Vulnerability:** The `/api/nvidia-proxy` endpoint lacked authentication checks, allowing unauthenticated attackers to proxy requests to the NVIDIA API using the server's API key (SSRF / Proxy abuse vulnerability).
**Learning:** In a full-stack Next.js/Vercel architecture, API endpoints that act as proxies for paid third-party services must explicitly verify the user session to prevent abuse, even if the client app dynamically passes keys for fallback.
**Prevention:** Always wrap external service proxy endpoints with `await getAuthenticatedUser(req)` or equivalent role guards, and separate client-provided API keys (via custom headers like `X-Nvidia-Api-Key`) from the Supabase session token in the `Authorization` header.
