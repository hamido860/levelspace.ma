## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2026-05-22 - [Added dynamic ARIA labels to map-rendered elements]
**Learning:** Icon-only elements rendered within mapped arrays (e.g., a list of tag removal buttons) cannot use static `aria-label`s. Screen readers need to distinguish between them to know exactly which item the action applies to.
**Action:** When rendering interactive icon-only elements dynamically, ensure `aria-label` and `title` attributes use template literals to include the unique item identifier (e.g., `aria-label={\`Remove tag \${tag}\`}`). Always include focus styles like `focus-visible:ring-*` for keyboard navigation.
