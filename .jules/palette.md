## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2026-07-01 - Enhance TagsManager Keyboard Accessibility
**Learning:** When rendering interactive icon-only elements dynamically within mapped arrays (e.g., tag removal buttons), ensure `aria-label` and `title` attributes use template literals to include the unique item identifier (e.g., `Remove tag ${tag}`) so screen readers can distinguish between them. Standard `focus-visible:ring-*` classes should be used for keyboard navigation.
**Action:** Applied semantic ARIA labels and focus rings to mapped interactive elements in TagsManager to improve screen reader context and keyboard navigation accessibility.
