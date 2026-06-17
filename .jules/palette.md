## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2024-06-17 - Improve Accessibility of dynamically generated icon buttons
**Learning:** Screen reader users rely heavily on dynamically populated attributes like aria-label when navigating lists of icon-only elements (e.g. "remove tag {tag name}"). Dynamically mapped elements like tags also need distinct focus indicators to support keyboard navigation.
**Action:** Always add unique `aria-label`s and `title` attributes (often interpolating the variable name) to loop-rendered items, and ensure `focus-visible:ring-*` classes are included.
