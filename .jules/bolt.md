## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-30 - O(N) optimizations for multiple metrics
**Learning:** For React performance optimization, when deriving multiple separate metrics from a large dataset (e.g., `allLessons` from Dexie), consolidating the iterations into a single `useMemo` hook that computes all metrics in one O(N) pass avoids redundant iterations and duplicate filtering/string manipulations across multiple separate `useMemo` hooks.
**Action:** When filtering or counting a dataset in multiple ways, use a single `reduce` or `forEach` in one `useMemo` to return all metrics.
