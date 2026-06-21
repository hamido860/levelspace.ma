## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2025-06-21 - Added ARIA labels to text formatting tools
**Learning:** Icon-only buttons (like Bold, Italic, List formatting options in a text editor) must have both `aria-label`s for screen readers and `title` attributes for native tooltips, alongside standard focus ring visibility for keyboard users to be fully accessible.
**Action:** Applied this pattern to `src/components/workspace/tools/TextInput.tsx` formatting buttons.
