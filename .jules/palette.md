## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2026-05-22 - [Added dynamic aria-label to password visibility toggle]
**Learning:** Icon-only toggle buttons (like password visibility Eye/EyeOff) that convey state must dynamically update their `aria-label` to reflect the action they will perform ("Show API key", "Hide API key"). Static labels ("Toggle visibility") leave screen reader users without context of the current state.
**Action:** When adding `aria-label`s to toggleable state buttons, use a ternary based on the state variable to describe the *next* action.
