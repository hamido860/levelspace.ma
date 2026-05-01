## 2024-05-24 - Weak Random Identifier Generation
**Vulnerability:** Found `Math.random().toString(36).substr(2, 9)` used to generate supposedly unique IDs for new study sessions, goals, and library items, as well as unique Supabase channel names. `Math.random()` is not cryptographically secure and can lead to predictable identifiers or collisions.
**Learning:** Pseudorandom number generators like `Math.random()` are predictable and insecure for identifier generation, especially for anything persisted or tracked in external systems (like Supabase channels or local state IDs).
**Prevention:** Always use cryptographically secure generation such as `crypto.randomUUID()` when creating unique identifiers in frontend and backend code.
