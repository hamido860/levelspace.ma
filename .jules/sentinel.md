## 2025-02-21 - Weak Random Number Generation for IDs
**Vulnerability:** Weak pseudo-random number generator `Math.random().toString(36)` was used to generate UUIDs/identifiers in several places (`src/pages/StudyPlanner.tsx`, `src/pages/Library.tsx`, `src/context/AppSettingsContext.tsx`).
**Learning:** This approach generates predictable values and should not be used for ID generation, as it can cause collisions or predictable IDs, which is a potential security and functional risk.
**Prevention:** Always use the Web Crypto API (`crypto.randomUUID()`) for generating unique identifiers.
