## 2024-04-26 - Added Accessibility to Topbar Icons
**Learning:** Standard icon-only buttons in navigation bars (like Topbar) need consistent `aria-label`s for screen readers and `focus-visible` classes to support keyboard navigation.
**Action:** Ensure all interactive icon-only elements across the app have `aria-label`s and `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes applied.
## 2024-05-18 - Icon-only buttons lacking ARIA labels
**Learning:** Icon-only buttons (like the `ChevronLeft`/`ChevronRight` used for collapsibles or calendars) often miss `aria-label`s and focus indicators, hurting screen reader accessibility and keyboard navigation.
**Action:** When adding such interactive elements, ensure they have an `aria-label` and `focus-visible` ring utility classes.
