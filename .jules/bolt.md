## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-23 - Dexie array derivations inline in JSX
**Learning:** In components with highly frequent state updates like timers (e.g., `Dashboard.tsx`), performing array operations like `.filter()`, `.sort()`, and `.slice()` directly inside the render block on arrays returned from `useLiveQuery` is disastrous for performance. They create brand new references on every single tick, bypassing React's reconciliation benefits and causing stutter.
**Action:** Extract all `.filter()`, `.sort()`, `.slice()`, or other array-deriving logic off `useLiveQuery` results into their own `useMemo` hooks *outside* the JSX.
