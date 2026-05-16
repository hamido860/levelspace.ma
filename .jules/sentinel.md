## 2024-05-24 - Unauthenticated NVIDIA Proxy Endpoint
**Vulnerability:** The `/api/nvidia-proxy` endpoint in `api/[...slug].ts` allowed unauthenticated requests to proxy commands to the NVIDIA API, leading to potential SSRF (Server-Side Request Forgery) and API key abuse.
**Learning:** External API proxy endpoints must always require authentication to prevent unauthorized usage of internal API keys or resources, especially in serverless functions.
**Prevention:** Use existing authentication middlewares or utilities (like `requireAuthenticatedUser`) in all API endpoints unless explicitly intended to be public.
