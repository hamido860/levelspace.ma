## 2024-04-26 - Added Accessibility to Topbar Icons
**Learning:** Standard icon-only buttons in navigation bars (like Topbar) need consistent `aria-label`s for screen readers and `focus-visible` classes to support keyboard navigation.
**Action:** Ensure all interactive icon-only elements across the app have `aria-label`s and `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes applied.

## 2024-05-18 - Making div elements clickable and accessible
**Learning:** React `div` elements used as interactive components need additional accessibility attributes (role="button", tabIndex={0}) and keyboard event handlers (onKeyDown with Space/Enter checking and preventing default) to properly function as buttons for keyboard and screen reader users. Also visual focus states should be applied.
**Action:** When a `<div onClick={...}>` is unavoidable (like for complex layout sections such as user profiles), always add: `role="button"`, `tabIndex={0}`, an appropriate `aria-label`, an `onKeyDown` handler to handle 'Enter' and ' ', and tailwind focus visible styles (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-lg`).

## 2024-05-18 - Sidebar Screen Reader Support
**Learning:** Icon-only navigation links in the Sidebar component were relying solely on visual context and `title` attributes, which provided insufficient context for screen readers when the sidebar was collapsed. Furthermore, focus rings were hidden or inconsistently applied, making keyboard navigation difficult to track.
**Action:** Always pair `lucide-react` icon-only buttons with explicit `aria-label`s sourced from the translation context. For interactive elements, apply `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` uniformly to ensure clear visual feedback for keyboard users without disrupting mouse user aesthetics.
