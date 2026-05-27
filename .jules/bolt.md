## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## 2026-05-22 - Memoize complex array derivations in React components with ticking timers
**Learning:** In a React component that contains frequently ticking states (e.g. `setInterval` updating a timer every second), inline derivations of arrays obtained from data sources like `useLiveQuery` (e.g., `reminders.filter(...).sort(...).slice(...)`) will be re-evaluated on every single render tick. This causes constant reference changes and degrades performance.
**Action:** Extract all such array derivations into `useMemo` hooks with their base source arrays as dependencies, so the expensive operations (filter/sort/map) only run when the actual data changes, not every time the component ticks.
