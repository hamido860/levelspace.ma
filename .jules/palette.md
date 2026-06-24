## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2026-05-24 - [Added ARIA labels and focus rings to Workspace Tools]
**Learning:** Found that utility toolbar buttons across various workspace tools (`AITool`, `DictionaryTool`, `ImageFetcher`, `MathEditor`, `TextInput`, `TimelineTool`) often lack `aria-label`s for screen readers and distinct focus styling (`focus-visible:ring-2 focus-visible:ring-accent`) for keyboard navigation.
**Action:** Always verify that every interactive button, particularly icon-only utility buttons, includes an explicit `aria-label` and the standard `focus-visible` ring utility classes to ensure full accessibility.
