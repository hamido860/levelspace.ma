## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2026-05-22 - Prevent cascading re-renders from inline fallback arrays
**Learning:** Using an inline array like `|| []` as a fallback for missing data creates a new array reference on every render. Because React hooks like `useMemo` perform strict equality checks (`[] === []` is `false`), this causes cascading, expensive re-renders in child components whenever the parent renders, especially common during Dexie `useLiveQuery` loading phases.
**Action:** Always define a file-scoped, stable reference `const EMPTY_ARRAY: any[] = [];` and use it for fallbacks (`const data = dbData || EMPTY_ARRAY;`) to guarantee referential stability and prevent unnecessary downstream updates.
