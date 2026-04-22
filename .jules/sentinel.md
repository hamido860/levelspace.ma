## 2024-05-15 - Insecure ID Generation with Math.random()
**Vulnerability:** The application used `Math.random().toString(36).substr(2, 9)` to generate unique identifiers for new study sessions, goals, and library items on the client-side.
**Learning:** `Math.random` is a weak pseudo-random number generator that is cryptographically insecure and prone to collisions, which could lead to ID conflicts or unpredictable behavior when managing entities locally. It is often a remnant of quick prototyping that persists into production.
**Prevention:** Use standard, cryptographically secure ID generation like `crypto.randomUUID()` available natively in modern web environments to ensure true uniqueness and security when generating identifiers.
