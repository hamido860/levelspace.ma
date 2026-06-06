## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2026-05-22 - [Dynamic ARIA labels for toggle state buttons]
**Learning:** Icon-only toggle buttons (like Read Aloud) often have static tooltips (e.g. "Read Aloud") that don't update when active, confusing screen reader users about current state/next action.
**Action:** Always use dynamic ternary expressions for `aria-label` and `title` on toggle buttons (e.g., `isSpeaking ? 'Stop reading' : 'Read aloud'`) to clearly communicate the action.
