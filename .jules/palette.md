## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2026-05-23 - [Added ARIA attributes to Timeline Zoom Controls]
**Learning:** For dynamic UI values adjusted by buttons (like zoom percentages), changes may not be announced to screen readers by default. Wrapping the text indicator in an element with `aria-live="polite"` ensures these state updates are announced properly.
**Action:** Always add `aria-live="polite"` to span or div elements displaying dynamic numerical values or states updated by adjacent icon buttons.
