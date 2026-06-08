## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## $(date +%Y-%m-%d) - Accessibility attributes on zoom buttons
**Learning:** Icon-only zoom buttons missing screen reader support and proper focus states can cause accessibility violations in Timeline components. The zoom percentage text needs to be announced to assistive technologies when it changes.
**Action:** Always add `aria-label`, `title`, and keyboard focus outline utility classes (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) to all icon-only action buttons. Wrap any dynamic numeric indicators, like zoom percentage, with `aria-live="polite"` so screen readers seamlessly announce updates.
