## 2024-04-26 - Added Accessibility to Topbar Icons
**Learning:** Standard icon-only buttons in navigation bars (like Topbar) need consistent `aria-label`s for screen readers and `focus-visible` classes to support keyboard navigation.
**Action:** Ensure all interactive icon-only elements across the app have `aria-label`s and `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes applied.
