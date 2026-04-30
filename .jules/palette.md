
## 2026-04-30 - Improve Topbar Keyboard Navigation
**Learning:** Interactive non-button header elements (like profile indicators) require explicit 'role="button"', 'tabIndex={0}', and 'onKeyDown' handlers (with e.preventDefault() for Space/Enter) to be accessible. Icon-only buttons must also feature 'aria-label' and explicit 'focus-visible' styles to support screen readers and keyboard users.
**Action:** Use these patterns consistently across navigation and interactive header components.
