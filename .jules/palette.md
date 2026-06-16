## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## $(date +%Y-%m-%d) - Added Missing ARIA Labels to Icon-Only Buttons
**Learning:** Found several modal components (`ConnectionStatusModal.tsx` and `Modal.tsx`) containing an `X` icon inside a `button` without an `aria-label`. This makes it difficult for screen readers to convey the button's purpose (closing the dialog).
**Action:** Ensure all icon-only interactive elements contain descriptive `aria-label`s for accessibility, such as `aria-label="Close dialog"`.
