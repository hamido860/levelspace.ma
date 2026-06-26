## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2024-06-25 - React Timer Hooks & Array Derivations
**Learning:** In components with frequent state updates like countdown timers (`Dashboard.tsx`, `Modules.tsx`), doing complex array derivations (`filter`, `sort`, `slice`) inline within JSX causes those expensive calculations and object allocations to happen on every render (e.g., every 1 second tick). This can lead to significant CPU overhead and UI stuttering on long lists.
**Action:** Always wrap array derivations in `useMemo` hooks with strict dependencies, so they are only re-evaluated when the source data or search queries change, rather than on every tick of an unrelated timer state.
