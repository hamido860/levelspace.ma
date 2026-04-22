## 2026-04-22 - Icon Button Accessibility
**Learning:** Adding `title` attributes to icon-only buttons isn't always enough for screen readers. They require explicit `aria-label` attributes. Additionally, ensuring keyboard navigation is visible by standardizing `focus-visible:ring-2` on icon buttons significantly improves the experience.
**Action:** Standardize adding both `aria-label` and `focus-visible` styling (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) for all icon-only interactive elements.
