## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-18 - Stable Array Fallbacks
**Learning:** When using `useLiveQuery` with fallbacks like `useLiveQuery(...) || []`, the inline empty array `[]` creates a new reference on every component render. This causes downstream `useMemo` hooks (like `settingsMap = useMemo(() => Object.fromEntries(...), [dbSettings])`) to re-evaluate on every render, wasting CPU cycles and potentially triggering cascading re-renders in child components.
**Action:** Define a module-level constant (e.g., `const EMPTY_ARRAY: any[] = [];`) outside the component and use it as the fallback (e.g., `useLiveQuery(...) || EMPTY_ARRAY`). This guarantees referential stability and prevents unnecessary hook execution while avoiding the overhead of `useMemo(() => [], [])`.
