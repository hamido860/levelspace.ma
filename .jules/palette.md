## 2026-04-29 - Improve Topbar Keyboard Navigation and ARIA Labels
**Learning:** Custom clickable `div` elements (like the Profile header) lacking keyboard interaction (role, tabIndex, onKeyDown) break navigation for keyboard users. Icon-only buttons without `aria-label` are invisible or confusing to screen readers.
**Action:** Always verify that interactive elements use native `<button>` tags or mimic their behavior fully when using `<div>`, and apply standard `focus-visible` class rings for focus state. Always add descriptive `aria-label` attributes to icon-only controls.
