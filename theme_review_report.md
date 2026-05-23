# Theme Architecture Review

## Current Setup
- **CSS Framework**: Tailwind CSS v4.
- **Dark Mode Approach**: Uses CSS variables (custom properties) defined in `:root` for light mode and `.dark` for dark mode, combined with `@custom-variant dark (&:where(.dark, .dark *));`.
- **Theme Variables**: Colors like `--background`, `--ink`, `--paper`, `--accent`, `--surface-low` etc. are defined and automatically switch when `.dark` class is present.
- **Theme Provider**: `ThemeContext.tsx` toggles the `.dark` class on the `window.document.documentElement` (`<html>` tag).
- **Tailwind Setup**: Because colors are defined as variables and mapped in `@theme` block, using classes like `bg-background` or `text-ink` naturally supports both light and dark modes without needing explicit `dark:bg-background` classes everywhere.
- **Exceptions**: Explicit `dark:` classes *are* used heavily in legacy UI elements, particularly inside `.admin-theme-scope` and older utility classes built on generic colors (e.g. `bg-slate-100 dark:bg-surface-mid`).


## Static Audit Findings

### 1. Inconsistent Class Usage in `src/index.css`
Several custom component classes in `src/index.css` use hardcoded colors without `dark:` equivalents or using the CSS variables.
- Example: `.ai-panel__container` uses `bg-white`, `border-slate-200`, `text-slate-950` but lacks `dark:` equivalents.
- Example: `.floating-btn` uses `bg-white border-slate-200` without dark overrides.
- Example: `.module-card`, `.module-dropdown` also lack dark equivalents.
*(Lines 480-610 in `src/index.css` appear to define legacy component classes that break the new theme variable pattern.)*

### 2. Hardcoded Values in UI Components
- **`AiKeyManager.tsx`**: Uses hardcoded `bg-white border-slate-200 text-slate-700` and `bg-slate-950 text-white` (lines 240, 254, 274, 355) rather than the theme semantic tokens (e.g. `bg-surface-low`, `text-ink-secondary`).
- **Admin Panel (`src/pages/Admin.tsx`)**: Uses many `-gray-` utility classes (`text-gray-400`, `bg-gray-100`, etc.). While there is a remap block in `index.css` (`.admin-theme-scope`), doing a full conversion to the CSS variables (`--ink`, `--surface-low`) would be cleaner and less prone to breaking when new components are added to the admin panel.
- **Other AI Modals**: Files like `TaskLogViewer.jsx`, `IssueCard.jsx`, `TaskStatusBoard.jsx`, and `ExecuteTaskModal.jsx` use raw `bg-white`, `border-slate-200`, etc. without `dark:` classes or using semantic variables.


## Dynamic UI Analysis
- The application uses `localhost:4321` to run the development server via Express wrapping Vite.
- Reviewing the HTML sent by the server, the root `documentElement` class manages the theme. Since the state logic depends on `ThemeContext.tsx`, testing dynamically requires visual inspection which is partially substituted here by deep code static analysis.
- **Specific Components Checked:**
  - `Topbar.tsx`: Contains the `toggleTheme` switch properly. The button uses the correct `useTheme` hook and updates local storage.
  - `src/index.css`: The root `:root` and `.dark` structures look fully setup for the new CSS variable-driven styling. The bug lies in older utility classes explicitly demanding `bg-white` instead of `bg-paper` or `bg-surface-low`, breaking the dark mode experience in those components.

## Proposed Action Items for Fixes
1. Clean up `src/index.css` (lines 480-610) legacy components by removing `bg-white`, `border-slate-200`, and `text-slate-700` and replacing them with `--surface-low`, `--border-surface-mid` (or Tailwind equivalents `bg-surface-low`, `border-surface-mid`).
2. Refactor `AiKeyManager.tsx` and AI task components to use semantic variables instead of hardcoded `bg-white`.
3. Fully adopt the semantic variable system in `Admin.tsx` by eliminating `-gray-` utility classes so it seamlessly transitions with `.dark`.
4. Ensure any explicitly `.admin-theme-scope` remaps are only used as fallbacks or ideally removed if the classes themselves can be rewritten.
