## 2024-04-26 - Added Accessibility to Topbar Icons
**Learning:** Standard icon-only buttons in navigation bars (like Topbar) need consistent `aria-label`s for screen readers and `focus-visible` classes to support keyboard navigation.
**Action:** Ensure all interactive icon-only elements across the app have `aria-label`s and `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes applied.

## 2024-05-18 - Making div elements clickable and accessible
**Learning:** React `div` elements used as interactive components need additional accessibility attributes (role="button", tabIndex={0}) and keyboard event handlers (onKeyDown with Space/Enter checking and preventing default) to properly function as buttons for keyboard and screen reader users. Also visual focus states should be applied.
**Action:** When a `<div onClick={...}>` is unavoidable (like for complex layout sections such as user profiles), always add: `role="button"`, `tabIndex={0}`, an appropriate `aria-label`, an `onKeyDown` handler to handle 'Enter' and ' ', and tailwind focus visible styles (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-lg`).

## 2024-05-10 - Consistent Keyboard Navigation and ARIA Labels for Global Navigation
**Learning:** Found that custom layout structures like Sidebar components can sometimes lack fundamental accessibility features such as ARIA labels for non-text interactive buttons (like collapse/expand buttons) and keyboard-navigable focus states, which degrades the experience for keyboard and screen reader users navigating the core layout.
**Action:** Always ensure that all global navigation `<button>` elements (e.g. Sidebar, Topbar, BottomNav) include descriptive `aria-label` attributes and implement consistent focus ring styling using Tailwind classes (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) so keyboard interaction is clearly visible and standard.
