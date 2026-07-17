# Dashboard Interaction and Tag Picker Regression Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore iframe card layout interactions, align progress and typography behavior, and make property/tag grouping visually unambiguous.

**Architecture:** Keep dashboard interaction ownership in `PersonalView`, expose iframe-only hover controls above the iframe browsing context, and constrain typography through CSS scopes. Keep grouped tag filtering in the existing picker but replace the expanded radio rail with one native select whose empty value represents the default ungrouped scope.

**Tech Stack:** TypeScript, Obsidian DOM APIs, CSS, Vitest/happy-dom, npm/esbuild.

---

### Task 1: Group hierarchy and tag group selection

**Files:**
- Modify: `src/modals/grouped-tag-picker.ts`
- Modify: `styles.css`
- Modify: `tests/views/field-tag-dom.test.ts`
- Modify: `tests/views/property-management-view.test.ts`
- Modify: `tests/views/task-dialog-layout.test.ts`

- [ ] **Step 1: Write failing tests**

Assert property members have an indented tree container. Assert the tag picker renders one `select`, defaults to the empty “未分组” option, exposes configured groups as options, and changes filtering scope when the select value changes.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/views/field-tag-dom.test.ts tests/views/property-management-view.test.ts tests/views/task-dialog-layout.test.ts` and expect failures for the current radio list and missing indentation.

- [ ] **Step 3: Implement and verify GREEN**

Replace the radio loop with a labeled native select, preserve the existing `selectedGroupId` filtering contract, and add a restrained left guide plus inline-start indentation to `.op-property-group-members`.

### Task 2: Iframe card drag and resize controls

**Files:**
- Modify: `src/views/personal-view.ts`
- Modify: `styles.css`
- Modify: `tests/views/dashboard-module-presentation.test.ts`

- [ ] **Step 1: Write a failing interaction contract test**

Assert iframe cards receive a dedicated draggable `.op-dashboard-drag-handle`, resize handles contain the standard diagonal icon, and both controls sit above the iframe and appear on hover/focus.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/views/dashboard-module-presentation.test.ts` and expect the new control assertions to fail.

- [ ] **Step 3: Implement and verify GREEN**

Create the iframe drag handle before module rendering, reuse the card drag data payload, add the resize icon, and style both controls as compact hover-only overlays without restoring card chrome.

### Task 3: Progress and typography regressions

**Files:**
- Modify: `styles.css`
- Modify: `tests/views/dashboard-module-presentation.test.ts`
- Modify: `tests/views/card-layout.test.ts`

- [ ] **Step 1: Write failing CSS contract tests**

Assert the linear check-in fill selector is limited to `.is-linear`, the semicircle track keeps full width, and the card heading uses fixed UI typography independent of `--op-dashboard-card-font-size`.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/views/dashboard-module-presentation.test.ts tests/views/card-layout.test.ts` and expect failures against the current broad direct-child selector and inherited heading size.

- [ ] **Step 3: Implement and verify GREEN**

Scope the linear fill rule, give the shared semicircle track explicit dimensions, and override heading descendants with `var(--font-ui-small)` while leaving card body content on the configurable size.

### Task 4: Full verification and deployment

**Files:**
- Modify when necessary: affected implementation and tests only

- [ ] **Step 1: Run `npm run lint` and `npm test`**

Expected: all checks pass.

- [ ] **Step 2: Build and deploy**

Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` and expect deployment to the test vault plugin directory.

- [ ] **Step 3: Restart and verify runtime behavior**

Use Obsidian CLI to restart the test vault, confirm iframe controls are above the frame, inspect check-in/percentage gauge geometry and heading font sizes, open a project dialog to inspect the single group selector, then check `dev:errors` and error-level console output.

