## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2026-05-22 - Dexie array derivations and stable fallbacks
**Learning:** During loading states for Dexie `useLiveQuery`, defaulting to empty arrays inline using `|| []` or `?? []` breaks referential stability, passing a new array reference on every render until loading completes. This causes cascading re-renders in child components relying on `useMemo` hooks dependent on those values.
**Action:** Extract the empty fallback array outside the component using `const EMPTY_ARRAY: any[] = [];` to preserve referential stability and substitute it for inline array declarations.
