## 2024-05-18 - Avoid array derivations inline in JSX
**Learning:** Found a derived array computation `filteredModules = modules.filter(...)` outside `useMemo` in `src/pages/Modules.tsx`, which recalculates on every render (e.g. countdown timer ticks), leading to unnecessary CPU load.
**Action:** Always wrap array filter/map operations derived from state in `useMemo` hooks, especially in components with frequent state updates.
