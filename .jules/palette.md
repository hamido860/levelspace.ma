## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.

## 2026-05-23 - [Added ARIA labels to workspace tool icon buttons]
**Learning:** Found multiple instances across interactive workspace tools (MathEditor, TimelineTool, TextInput, ImageFetcher) where icon-only action buttons lacked `aria-label` attributes. While they often had `title` attributes for sighted users, relying solely on `title` is insufficient for comprehensive screen reader accessibility. Also noted the importance of applying standard `focus-visible` styles to these elements for keyboard navigation.
**Action:** Always verify that every icon-only button contains an explicit `aria-label` attribute in addition to a `title`, and ensure consistent `focus-visible:ring-2` styles are applied across all interactive tool components.
