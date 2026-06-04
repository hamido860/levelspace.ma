## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-18 - Memoize Dexie live query empty array fallbacks
**Learning:** In React components using Dexie.js `useLiveQuery`, assigning `|| []` as a fallback for missing data creates a new array reference on every render when the query resolves to undefined (e.g. during initial loading). Because these references are commonly used as dependency inputs for `useMemo` hooks down the component tree, this causes those memoization hooks to needlessly re-evaluate and trigger cascading re-renders in child components.
**Action:** Always define a global `const EMPTY_ARRAY = [];` outside the component scope and use `|| EMPTY_ARRAY` as the fallback to ensure referential stability during loading states.
