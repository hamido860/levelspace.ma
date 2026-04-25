## 2024-04-26 - Memoize derived useLiveQuery values
**Learning:** In Dexie-based React applications, using `useLiveQuery` returns a new object reference on every database update. Deriving data from this live query (e.g., `.map()`, `.filter()`, `Object.fromEntries()`) directly inside the component body creates a massive re-render bottleneck.
**Action:** Always wrap derived primitives/objects constructed from `useLiveQuery` returns in `useMemo` with the live query result as the dependency to prevent unnecessary cascading re-renders in deep component trees.
