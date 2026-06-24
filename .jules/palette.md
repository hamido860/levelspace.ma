## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2024-06-19 - TagsManager Remove Button Accessibility
**Learning:** Found that dynamically mapped icon-only buttons (like tag removal Xs) were missing unique `aria-label`s, `title` tooltips, and keyboard `focus-visible` styling, violating accessibility guidelines for interactive elements.
**Action:** When adding remove or action buttons inside mapped lists, always use template literals to inject the item's unique identifier into the `aria-label` and `title` (e.g., ``aria-label={`Remove tag ${tag}`}``) and apply `focus-visible:ring-*` classes for clear keyboard navigation states.
