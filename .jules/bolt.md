## 2025-04-28 - Missing useMemo with Dexie's useLiveQuery
**Learning:** `useLiveQuery` triggers a re-render on any database update. If derived data is created inline without `useMemo` (e.g. `Object.fromEntries(dbSettings.map(...))` or `.filter()`), the component receives new object references on every update. This creates a severe performance bottleneck with cascading re-renders across the component tree.
**Action:** Always wrap derived data based on `useLiveQuery` results in `useMemo`, using the query result as the dependency.
