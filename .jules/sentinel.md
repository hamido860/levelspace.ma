## 2024-05-18 - Hardcoded API Key Exposure

**Vulnerability:** A fallback NVIDIA API key was hardcoded in `api/ai-analyst.ts` as `FALLBACK_NVIDIA_KEY`, exposing the key directly in the codebase and any public repository history.

**Learning:** This typically happens during development testing when setting up environment variables locally is bypassed for convenience. It leaves critical credentials exposed to anyone with code access.

**Prevention:** Never commit API keys or sensitive credentials directly to the source code. Always rely on environment variables (e.g., `process.env.NVIDIA_API_KEY`) and properly manage secrets via platform configuration (e.g., Vercel environment variables) or a local `.env` file that is ignored by Git.
