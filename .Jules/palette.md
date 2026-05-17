## 2024-05-17 - Sidebar Toggle Accessibility
**Learning:** For interactive icon-only elements like the sidebar collapse/expand toggle, it's crucial to provide screen reader support with `aria-label` (using translation strings where i18n is configured) and clear visual focus indicators via `focus-visible` classes.
**Action:** Always add `aria-label` mapped to translation context variables, along with `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` for interactive icons.
