## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## $(date +%Y-%m-%d) - Add aria-labels and focus states to TextInput formatting tools
**Learning:** Found that the text formatting buttons (`<Bold />`, `<Italic />`, `<List />`) in `TextInput.tsx` were missing ARIA labels and focus visibility, relying only on hover states for interaction cues.
**Action:** Always add `aria-label`, `title`, and explicit `focus-visible:ring-2 focus-visible:ring-accent` utility classes to icon-only buttons to ensure they are accessible to both screen readers and keyboard navigators.
