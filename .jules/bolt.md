
## 2024-04-26 - [Dexie useLiveQuery Derived Data Bottleneck]
**Learning:** Returning unmemoized arrays/objects mapped directly from `useLiveQuery` causes a waterfall of render cycles. In Dexie, any data source change triggering a `useLiveQuery` refresh constructs entirely new memory references for properties derived with `.map`, `.filter`, or `Object.fromEntries()`, negating React's virtual DOM reconciliation efficiencies.

**Action:** Whenever data is retrieved using `useLiveQuery` inside a React component, explicitly wrap any computationally derived transformations of that data in a `useMemo` hook, with the raw live query result as the dependency.
