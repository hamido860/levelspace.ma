## 2026-05-22 - [Added ARIA labels to Sidebar and BottomNav]
**Learning:** Found that when `Sidebar` is collapsed, navigation items become icon-only without `aria-label`s, making them unreadable for screen readers. Toggle buttons need dynamic `aria-expanded` and `aria-label` to provide context.
**Action:** Always check components with collapsed/icon-only visual states to ensure they have an explicit `aria-label` or `title` so screen readers still get context.
## 2024-05-15 - Adding accessible labels and focus rings to AIAssistant buttons
**Learning:** Icon-only buttons (like those found in chat interfaces) frequently lack screen-reader accessible names. A common pattern in this app is using multiple buttons with raw lucide-react icons without explicit semantic structure or native tooltips.
**Action:** Always verify that every `<button>` and `<motion.button>` tag acting as an icon-only interactive element has an `aria-label`, an optional `title` for visual tooltips, and standard keyboard navigation `focus-visible` ring utilities (`focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`).
