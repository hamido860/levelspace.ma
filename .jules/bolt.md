## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-23 - Dexie array derivations in Dashboard
**Learning:** Found array derivations (filter and sort) applied directly to Dexie's `useLiveQuery` results in `src/pages/Dashboard.tsx` (`reminders`). This causes unnecessary object creations and React re-renders, especially because `useLiveQuery` may trigger multiple re-renders or be affected by other changes.
**Action:** Wrap derivations of `useLiveQuery` arrays in `useMemo` to prevent these cascading re-renders, in line with established codebase patterns for Dexie live queries.
