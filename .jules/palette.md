## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2024-07-01 - Icon-Only Tool Buttons Need Aria Labels & Focus Rings
**Learning:** Several workspace tools (TimelineTool, MathEditor, ImageFetcher, TextInput) use icon-only `<button>` components for their core toolbar actions (zoom, copy, clear, text formatting). These were completely inaccessible to screen readers due to missing `aria-label`s, and invisible to keyboard navigation due to missing standard `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility classes.
**Action:** When adding or modifying interactive icon-only elements anywhere in the workspace tools, always explicitly provide `aria-label` and `focus-visible` ring classes so they integrate correctly with keyboard navigation and screen reader setups.
