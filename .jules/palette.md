## 2024-05-08 - Consistent Accessible Icon Buttons

**Learning:** This codebase uses a consistent set of Tailwind classes (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) for accessible keyboard navigation on interactive elements. Icon-only buttons frequently miss `aria-label`s, which is critical for screen reader users.

**Action:** Whenever adding or updating icon-only buttons, ensure they have an explicit `aria-label` attribute and the standard focus ring classes to support both screen readers and keyboard-only navigation.
