## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2025-06-20 - [Focus Visible Verification]
**Learning:** When visually testing Tailwind `focus-visible` styles with Playwright, programmatically calling `.focus()` on an element triggers focus but often does not trigger the visual `focus-visible` ring because the browser didn't register keyboard intent.
**Action:** Use `page.keyboard.press('Tab')` to simulate true keyboard navigation if you need to reliably capture the `focus-visible` state in screenshots.
