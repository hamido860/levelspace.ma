## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-06-23 - Memoize array mapping and reduce inline object allocations
**Learning:** React components containing multiple live queries defaulting to `|| []` generate completely new empty array references on every component render during loading phases. Additionally, performing `.filter()`, `.sort()`, and `.slice()` operations inline directly inside the return JSX forces React to do expensive O(N log N) array derivations on every render tick (e.g. from countdown timers).
**Action:** Establish referentially stable constants like `const EMPTY_ARRAY: any[] = []` outside components for fallback defaults. Always extract array transformations like sorting and filtering into `useMemo` hooks, keeping the JSX clean and only iterating over the final derived array.
