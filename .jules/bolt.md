## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2025-05-18 - [Referential Stability of Default Arrays in React Hooks]
**Learning:** `useLiveQuery` can return `undefined` on initial load or empty results, so the codebase falls back to `|| []`. However, doing `|| []` inside functional components, even when fetching data using `useLiveQuery`, recreates the array on every render, which can cause downstream `useMemo` hooks or `useEffect`s that depend on these arrays to re-evaluate constantly.
**Action:** Extract the empty array to a constant outside the component (`const EMPTY_ARRAY = [];`) to ensure referential stability and prevent unnecessary re-renders. Type it as `any[]` if needed to avoid TypeScript strict assignment issues.
