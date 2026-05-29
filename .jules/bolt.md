## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-30 - Fallback Empty Arrays in Hooks
**Learning:** While wrapping empty array fallbacks in `useMemo` (e.g., `const items = useMemo(() => queryResult || [], [queryResult])`) ensures referential stability, defining a static constant outside the component (`const EMPTY_ARRAY = []`) and using it directly (`const items = queryResult || EMPTY_ARRAY`) is even more performant because it completely avoids the overhead of executing a React hook.
**Action:** When providing stable fallbacks for arrays to maintain referential equality, prefer declaring an `EMPTY_ARRAY` constant outside the component instead of using `useMemo` specifically for the empty fallback.
