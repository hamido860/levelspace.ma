## 2026-04-28 - Memoization for useLiveQuery Derived Objects
**Learning:** In React components using Dexie's `useLiveQuery`, mapping query results into objects (like `settingsMap`) without memoization causes severe cascading re-renders. The query updates trigger re-renders, and reconstructing the object creates new references every time, defeating React's reference equality checks on props.
**Action:** Always wrap object constructions and filtering logic applied to `useLiveQuery` results in `useMemo` to maintain reference stability for descendant components.
