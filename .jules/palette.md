## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2025-02-28 - Timeline Zoom Buttons
**Learning:** For interactive icon-only elements adjusting dynamic values (like zoom percentages), `aria-live="polite"` must be added to the value display element to ensure screen readers announce changes, while the buttons need `aria-label`, `title`, and focus classes.
**Action:** Always wrap dynamically adjusted indicators in `aria-live="polite"` and ensure the buttons triggering the adjustment are accessible.
