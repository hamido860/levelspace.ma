## 2024-04-26 - Added Accessibility to Topbar Icons
**Learning:** Standard icon-only buttons in navigation bars (like Topbar) need consistent `aria-label`s for screen readers and `focus-visible` classes to support keyboard navigation.
**Action:** Ensure all interactive icon-only elements across the app have `aria-label`s and `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes applied.

## 2024-05-18 - Making div elements clickable and accessible
**Learning:** React `div` elements used as interactive components need additional accessibility attributes (role="button", tabIndex={0}) and keyboard event handlers (onKeyDown with Space/Enter checking and preventing default) to properly function as buttons for keyboard and screen reader users. Also visual focus states should be applied.
**Action:** When a `<div onClick={...}>` is unavoidable (like for complex layout sections such as user profiles), always add: `role="button"`, `tabIndex={0}`, an appropriate `aria-label`, an `onKeyDown` handler to handle 'Enter' and ' ', and tailwind focus visible styles (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-lg`).
## 2024-05-13 - Focus Styles on Sidebar Links and Mobile Navigation
**Learning:** React Router `navigate()` attached to generic `<button>` elements in mobile navigation doesn't get automatic focus outline styles, unlike typical text links, causing keyboard and screen reader accessibility gaps when navigating the sidebar items. Furthermore, interactive collapse toggles using icons needed explicit ARIA labels and titles.
**Action:** Consistently applied `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` to custom interactive components that function as links or toggles, and added `aria-label` along with `title` for better screen reader/tooltip support.
