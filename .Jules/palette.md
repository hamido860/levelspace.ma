## 2025-02-28 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a consistent pattern across top navigation where icon-only buttons (like notifications, settings, language, theme) relied only on title attributes or context, missing crucial `aria-label`s for screen readers.
**Action:** Always verify icon-only buttons (`<button><Icon /></button>`) include descriptive `aria-label`s along with titles, and systematically audit other navigation components for this pattern.
