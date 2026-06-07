## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2024-06-08 - Icon-Only Button Accessibility in Modals
**Learning:** Icon-only buttons within complex modals (like `AiKeysModal`) often lack `aria-label`s and distinct focus indicators (`focus-visible` rings), making them difficult to use for keyboard navigators and screen reader users. The application relies heavily on visual icons (eye, plus, trash) for primary actions.
**Action:** When auditing or building modals, always verify that every interactive icon element has a dynamic or static `aria-label` reflecting its current purpose, and standard focus ring classes (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) for consistent keyboard navigation.
