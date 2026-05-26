## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2024-05-26 - Dynamic ARIA Labels for State Toggles
**Learning:** For icon-only toggle buttons that convey state (like Eye/EyeOff for password visibility), a static `aria-label` doesn't provide enough context about the current state or the result of interacting with the button. Screen reader users might not know whether clicking the button will show or hide the information.
**Action:** Dynamically update the `aria-label` using a ternary operator based on the state variable to clearly reflect the next action (e.g., `aria-label={showKey ? 'Hide API key' : 'Show API key'}`). Always include standard focus classes (`focus:outline-none focus-visible:ring-2`) for keyboard accessibility.
