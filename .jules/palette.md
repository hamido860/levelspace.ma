## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2024-06-03 - Dynamic ARIA Labels for State Toggles
**Learning:** For icon-only toggle buttons that convey state (like Eye/EyeOff for visibility), static aria-labels can be confusing.
**Action:** Dynamically update their `aria-label` to reflect the next action they will perform (e.g., 'Show API key' vs 'Hide API key') using a ternary operator based on the state variable to ensure accurate screen reader announcements.
