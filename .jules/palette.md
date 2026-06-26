## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2024-07-29 - Accessibility for Icon-only Interactive Array Elements
**Learning:** For dynamic UI values modified by buttons (e.g., zoom percentages), users of screen readers need feedback when the value changes.
**Action:** Wrap the text indicator in an element with `aria-live="polite"` so changes are announced properly by screen readers when updated via icon buttons.
