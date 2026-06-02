## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-06-02 - Stabilizing empty array fallbacks for useLiveQuery
**Learning:** Using inline empty arrays (`|| []`) as fallbacks for `useLiveQuery` results creates new array references on every render while the query is loading (returning `undefined`). If these arrays are used as dependencies in `useMemo` hooks, the hooks will re-evaluate on every tick, causing cascading re-renders in derived state and child components, wasting CPU cycles and leading to UI stuttering.
**Action:** Always extract the empty array fallback into a constant outside the component (`const EMPTY_ARRAY: any[] = [];`) to ensure referential stability and prevent unnecessary React updates during the loading phase.
