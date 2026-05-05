## 2024-05-05 - Missing Focus Outlines on Icon-Only Buttons
**Learning:** This application lacks inherent keyboard focus styling and aria-labels for various icon-only utility buttons in high-traffic areas like Topbar (Refresh Connection, Theme Toggle, Settings, Notifications, Language).
**Action:** When creating or fixing custom icon buttons, always apply aria-label based on title/intent and the standard `focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1` utility sequence.
