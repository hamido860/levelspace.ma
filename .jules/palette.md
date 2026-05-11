## 2024-05-11 - Add ARIA labels and focus rings to icon-only navigation elements
**Learning:** Icon-only navigation buttons in global components (Sidebar, BottomNav, Topbar tools) frequently lack `aria-label` attributes and focus visible rings, which limits accessibility for screen reader and keyboard navigation users.
**Action:** Consistently apply `aria-label` attributes and standardize keyboard focus styles using Tailwind utilities like `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` on all icon-only buttons.
