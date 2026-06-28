## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.

## 2024-05-18 - Single Pass Aggregation for Component Stats
**Learning:** In `src/pages/Modules.tsx`, aggregating component statistics using multiple separate `useMemo` hooks over the same large Dexie dataset (`allLessons`) resulted in redundant O(N) array traversals, redundant filtering, and duplicated string operations (e.g., `trim().toLocaleLowerCase()`). This caused unnecessary memory allocations and CPU cycles on each re-render update.
**Action:** Consolidate multiple metric computations over the same dataset into a single `useMemo` block with one O(N) traversal, destructuring the results back into the same variable names to avoid downstream component logic changes.
