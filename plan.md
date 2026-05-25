1. **Understand & Analyze**: The `MathEditor` component in `src/components/workspace/tools/MathEditor.tsx` is long and contains a mix of business logic (state, copy-paste handlers, AI interactions) and presentational concerns (toolbar, math-field, output view, and pro tip).
2. **Refactoring Strategy**:
    - Extract a custom hook `useMathEditor` to manage the component's internal state, hooks, and event handlers (e.g. `copied`, `handleInput`, `handleCopy`, `handleClear`, `handleSendToAI`).
    - Extract smaller presentational components: `MathEditorToolbar`, `LatexOutput`, and `ProTip`.
    - Refactor the main `MathEditor` component to consume the hook and render the smaller components, vastly simplifying the main component and improving readability.
3. **Execution**: Implement the changes in `MathEditor.tsx` while preserving all existing behaviors, types, and logic.
4. **Verification**: Compile the code and run standard checks (if available) to ensure TypeScript types match and everything works as expected. Complete pre-commit step.
