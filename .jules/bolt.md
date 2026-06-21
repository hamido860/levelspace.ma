## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2026-06-21 - Use stable fallbacks in React hooks to prevent cascading re-renders
**Learning:** Using an inline array `[]` as a fallback value for `useLiveQuery` (e.g. `const data = useLiveQuery(...) || []`) causes a new array reference to be created on every render when the query result is undefined. This referential instability can cause any downstream `useMemo` hooks dependent on this value to re-evaluate unnecessarily, leading to cascading re-renders.
**Action:** Always define a constant empty array outside the component (e.g., `const EMPTY_ARRAY: any[] = [];`) and use it as the fallback value (e.g., `const data = useLiveQuery(...) || EMPTY_ARRAY;`) to guarantee referential stability and prevent unnecessary React re-renders.
