## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2024-05-23 - Hover-only buttons keyboard accessibility
**Learning:** Icon buttons that rely on `opacity-0 group-hover:opacity-100` are completely inaccessible to keyboard users because they remain invisible when focused via the `Tab` key.
**Action:** Always add `focus:opacity-100` alongside hover-opacity utility classes to ensure buttons become visible when receiving keyboard focus, and include standard focus rings (`focus:outline-none focus-visible:ring-2`).
