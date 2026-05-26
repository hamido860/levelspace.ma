## 2024-05-09 - Memoize Dexie live query derived values
**Learning:** In React components using Dexie.js `useLiveQuery`, derived data structures from query arrays (e.g. `Object.fromEntries(dbSettings.map(...))`) create new object references on every render. Because `useLiveQuery` re-evaluates frequently or whenever the database changes, these new references cause expensive, cascading re-renders in child components.
**Action:** Always wrap data derived from `useLiveQuery` results (like `.map`, `.filter`, or `Object.fromEntries`) with `useMemo` using the raw live query results as the dependency array.
## 2026-05-22 - Dexie array derivations
**Learning:** The same pattern from the 2024-05-09 entry (Dexie live queries returning raw arrays that get transformed into derived objects causing cascading re-renders) also affects array filtering and mapping operations like `.filter()` and `.map()`.
**Action:** Wrap all complex array derivations off of `useLiveQuery` arrays in `useMemo`.
## $(date +%Y-%m-%d) - Array map and sort operations off Dexie queries in Dashboard
**Learning:** In the Dashboard component, derived arrays from Dexie (`reminders` and `schedule`) were being filtered and sorted inline within the JSX render payload using operations like `.filter()`, `.sort()`, and `.slice()`. These operations create new array references constantly as `useLiveQuery` is evaluated and cause unnecessary re-renders of the component.
**Action:** Extract these expensive derived lists into `useMemo` hooks using the original array queries from Dexie as the dependency.
