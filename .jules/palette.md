## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2024-06-29 - Accessible Mapped Icon-Only Buttons
**Learning:** When rendering dynamic/mapped interactive icon-only elements (e.g., a list of tag removal buttons), `aria-label` and `title` attributes must use template literals to include the unique item identifier so screen readers can distinguish between them, alongside standard `focus-visible:ring-*` classes.
**Action:** Always include unique identifiers in `aria-label` and `title` when mapping over interactive elements in React, instead of generic labels like "Remove tag".
