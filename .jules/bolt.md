## 2024-05-13 - Memoizing Dexie useLiveQuery results
**Learning:** `useLiveQuery` triggers a re-render whenever the watched data in Dexie updates. However, if you derive objects or filter arrays from `useLiveQuery` results without wrapping them in `useMemo`, you create new object references on every render. This forces child React components to unnecessarily re-render, creating severe performance bottlenecks, particularly when dealing with long lists or complex derived states (e.g., in `Modules.tsx` and `Dashboard.tsx`).
**Action:** Always wrap `.map()`, `.filter()`, or `Object.fromEntries()` operations over `useLiveQuery` results in a `useMemo` block with the raw query result as the dependency to avoid referential instability and cascading component re-renders.

## 2024-05-13 - Adding inline comments for micro-optimizations
**Learning:** Adding `useMemo` hooks as a performance optimization creates potential confusion for future maintainers. Without context, it's not immediately clear *why* a particular value is memoized (e.g. referential equality vs computationally expensive).
**Action:** Always include inline comments explaining *why* `useMemo` or other micro-optimizations are used (e.g. "Memoize to preserve referential equality and avoid re-filtering array on every render loop") so the code intent is clear.
