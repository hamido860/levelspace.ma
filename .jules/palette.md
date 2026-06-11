## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2026-05-29 - [Modal Component Close Button Accessibility]
**Learning:** Found that foundational UI components (like `Modal.tsx`) occasionally omit `aria-label`, `title`, and `focus-visible` rings on icon-only close buttons. This prevents screen readers from announcing the action and hides keyboard focus context.
**Action:** Always verify that foundational, heavily reused components have complete a11y properties, specifically checking for `aria-label`, `title`, and `focus:outline-none focus-visible:ring-2` on any icon-only interactive element.
