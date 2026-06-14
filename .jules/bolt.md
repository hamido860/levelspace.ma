## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-23 - Memoize Array Transformations in JSX
**Learning:** Found a component (`Dashboard.tsx`) that was repeatedly filtering and sorting a `useLiveQuery` array (`reminders`) directly inside the JSX loop. This caused expensive O(n log n) sorting operations and array object creations on every render, which is particularly bad when components have fast-ticking states (like the interval timer on the dashboard).
**Action:** Extract inline `.filter()` and `.sort()` operations applied to dynamically queried arrays into `useMemo` hooks, using the raw query array as the dependency. This prevents cascading re-renders and CPU waste.
