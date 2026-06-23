## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2025-02-23 - Interactive Tags List
**Learning:** Icon-only remove buttons in tag lists often miss ARIA labels, making screen readers unaware of which specific tag will be deleted. They also often lack focus rings to indicate keyboard focus.
**Action:** Always add unique `aria-label` (e.g., `aria-label={`Remove tag ${tag}`}`) and `title` to mapped icon-only buttons. Add `focus-visible` styles (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) for visual keyboard focus indicators.
