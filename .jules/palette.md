## 2026-05-04 - Standardize Icon Button Accessibility
**Learning:** In this codebase, icon-only buttons require specific Tailwind classes (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) alongside `aria-label` to ensure standard keyboard accessibility and focus visibility.
**Action:** Always verify that interactive icon-only elements have both an `aria-label` and these specific focus classes to maintain a consistent keyboard navigation experience.
