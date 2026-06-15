## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2025-05-22 - Adding accessibility context to dynamic UI indicators
**Learning:** In interactive elements that update an adjacent textual UI indicator (such as icon buttons controlling zoom levels), screen readers may fail to announce the resulting numeric state change, leaving non-visual users unaware of the action's effect.
**Action:** Always wrap dynamic textual indicators (like zoom percentages) in an element with `aria-live="polite"` so state changes are announced seamlessly, and pair this with clear `aria-label` and `title` attributes on the controlling buttons.
