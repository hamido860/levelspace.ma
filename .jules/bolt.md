## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-05-15 - Dashboard arrays
**Learning:** React state variables triggered by timers inside of components that feature inline array operations, like sorting and mapping, perform these heavy calculations on every timer tick. In components like Dashboard where `timerSeconds` updates regularly, it can cause severe UI stuttering and unresponsiveness.
**Action:** Extract large or moderately sized inline `.filter()`, `.sort()`, or `.map()` arrays derived from state/hooks into `useMemo`, allowing React to refer to previously calculated results unless the origin state changes.
