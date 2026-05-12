## 2024-04-26 - Added Accessibility to Topbar Icons
**Learning:** Standard icon-only buttons in navigation bars (like Topbar) need consistent `aria-label`s for screen readers and `focus-visible` classes to support keyboard navigation.
**Action:** Ensure all interactive icon-only elements across the app have `aria-label`s and `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes applied.

## 2024-05-18 - Making div elements clickable and accessible
**Learning:** React `div` elements used as interactive components need additional accessibility attributes (role="button", tabIndex={0}) and keyboard event handlers (onKeyDown with Space/Enter checking and preventing default) to properly function as buttons for keyboard and screen reader users. Also visual focus states should be applied.
**Action:** When a `<div onClick={...}>` is unavoidable (like for complex layout sections such as user profiles), always add: `role="button"`, `tabIndex={0}`, an appropriate `aria-label`, an `onKeyDown` handler to handle 'Enter' and ' ', and tailwind focus visible styles (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-lg`).

## 2024-05-20 - Ensure Tool Workspace Buttons are Accessible
**Learning:** Icon-only buttons within workspace tools (such as text formatters in TextInput, zoom controls in Timeline, and copy/clear in MathEditor) frequently miss `aria-label`s and visual focus indicators. These form controls are crucial for keyboard-only or screen reader users to understand and operate the workspace effectively.
**Action:** When creating or maintaining workspace tools with interactive icons, add an `aria-label` that explicitly describes the action (e.g., "Bold text", "Clear editor"), along with standard focus states (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`). Use `title` for visual tooltips where appropriate.
