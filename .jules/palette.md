## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2024-05-18 - Missing ARIA Labels & Focus States on Secondary Workspace Icons
**Learning:** Secondary, contextual icon-only buttons nested deep within floating workspace tools (e.g., text formatting toolbars, modal close buttons, clear actions) often miss basic keyboard accessibility features compared to primary navigation elements. Users relying on screen readers receive no context for these actions, and keyboard users lack visual feedback for focus.
**Action:** Always verify that embedded workspace toolbar buttons use the standard accessible focus pattern (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`) and include descriptive `aria-label` and `title` attributes (e.g., `aria-label="Bold text" title="Bold"`).
