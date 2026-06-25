## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2026-05-22 - [Dynamic ARIA Labels for Mapped Icon Elements]
**Learning:** When mapping over an array of items and rendering interactive icon-only elements (like a "Remove" button per tag in `TagsManager`), static labels are insufficient. Screen readers cannot differentiate which item will be removed.
**Action:** Use template literals inside `aria-label` and `title` attributes (e.g., `aria-label={\`Remove tag \${tag}\`}`) to ensure screen readers provide clear, unique context for each interactive element within a mapped list.
