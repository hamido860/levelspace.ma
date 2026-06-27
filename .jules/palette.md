## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2024-06-27 - [A11y] Dynamic Icon-only Buttons
**Learning:** When rendering interactive icon-only elements dynamically within mapped arrays (e.g., a list of tag removal buttons), ensure `aria-label` and `title` attributes use template literals to include the unique item identifier so screen readers can distinguish between them, alongside standard `focus-visible:ring-*` classes.
**Action:** Always add unique `aria-label` and `title` to mapped icon-only buttons.
