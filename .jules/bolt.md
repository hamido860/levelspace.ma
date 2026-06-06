## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-15 - Stable array fallback for useLiveQuery loading states
**Learning:** When using Dexie `useLiveQuery` to fetch arrays, using inline dynamic array fallbacks like `|| []` when the query returns `undefined` (loading state) breaks referential equality in React. This causes dependent `useMemo` hooks or child components receiving the array to re-evaluate/re-render unnecessarily on every tick.
**Action:** Define a module-scoped constant `const EMPTY_ARRAY: any[] = [];` and use it as the fallback: `useLiveQuery(...) || EMPTY_ARRAY`.
