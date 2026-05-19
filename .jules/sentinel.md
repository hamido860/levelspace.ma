## 2024-05-19 - [SSRF Protection] Securing Serverless Proxy Endpoints
**Vulnerability:** Unauthenticated API proxy endpoint (`/api/nvidia-proxy`) allowed unrestricted usage of third-party API endpoints, posing an SSRF (Server-Side Request Forgery) and abuse/billing risk.
**Learning:** Any serverless API proxy that tunnels requests to external services (like NVIDIA's API) using server-side secrets must ensure requests originate from authenticated users to prevent public abuse.
**Prevention:** Apply authentication middlewares or decorators (like `requireAuthenticatedUser`) at the very beginning of server-side proxy handlers to validate user session/tokens before processing the request.
