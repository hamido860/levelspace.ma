
## 2025-05-12 - Secure Serverless API Endpoints Against SSRF
**Vulnerability:** The `/api/nvidia-proxy` serverless endpoint lacked authentication, allowing unauthenticated public requests to consume server-side LLM API quota (a Server-Side Request Forgery and unauthenticated abuse vulnerability).
**Learning:** To support both client-side custom API keys and server-provided API keys in an authenticated proxy without conflict, separate headers are required. The standard `Authorization` header must carry the user's secure Supabase token, while custom external service keys (like NVIDIA) should be passed in a separate `X-[Service]-Api-Key` header.
**Prevention:** Always enforce backend route security with `getAuthenticatedUser(req)` on serverless proxy endpoints. Never repurpose the primary `Authorization` header to hold third-party service keys when standard user authentication is still required.
