## 2024-04-26 - Added Accessibility to Topbar Icons
**Learning:** Standard icon-only buttons in navigation bars (like Topbar) need consistent `aria-label`s for screen readers and `focus-visible` classes to support keyboard navigation.
**Action:** Ensure all interactive icon-only elements across the app have `aria-label`s and `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes applied.

## 2024-05-18 - Making div elements clickable and accessible
**Learning:** React `div` elements used as interactive components need additional accessibility attributes (role="button", tabIndex={0}) and keyboard event handlers (onKeyDown with Space/Enter checking and preventing default) to properly function as buttons for keyboard and screen reader users. Also visual focus states should be applied.
**Action:** When a `<div onClick={...}>` is unavoidable (like for complex layout sections such as user profiles), always add: `role="button"`, `tabIndex={0}`, an appropriate `aria-label`, an `onKeyDown` handler to handle 'Enter' and ' ', and tailwind focus visible styles (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-lg`).

## 2024-05-24 - Interactive Workspace Tools Accessibility
**Learning:** Icon-only interactive elements in workspace components (`TextInput.tsx`, `TimelineTool.tsx`, etc.) are frequently missing descriptive `aria-label`s and clear visual focus states, making them inaccessible to screen reader users and difficult for keyboard navigators.
**Action:** Standardize on adding `aria-label` attributes to all icon-only buttons. Add the app's standard accessibility focus classes (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) for visible keyboard navigation. For dynamic values adjusted by these buttons (like zoom percentages), wrap them in `aria-live="polite"` so changes are announced properly.
