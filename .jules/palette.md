## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## $(date +%Y-%m-%d) - [a11y] Added standard keyboard focus rings to Sidebar interactive components
**Learning:** Standardizing keyboard navigation accessibility requires more than ARIA labels. Users rely on focus states to see where they are on the page. Missing `focus-visible` styling means these elements are invisible when navigating via keyboard.
**Action:** Consistently add `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` styling to `<button>`, `<Link>`, and other standard interactive elements (`SidebarNavItem`, `MobileNavItem`, and custom icons/action buttons) going forward, preserving the visual layout across all navigation paradigms.
