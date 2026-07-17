# Unified Project Metadata and Property Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge property actions into one native menu, unify built-in and custom project metadata configuration, make priority options configurable, repair task metadata creation feedback, and correct card/reference presentation.

**Architecture:** Extend Obsidian's event-owned property menu instead of opening a second menu. Keep built-in project fields in `TaskFieldConfig` and custom fields in `TaskConfigurationTemplate.customFields`, but render and mutate both through one metadata editor and one add menu. Preserve fixed Tasks-compatible task metadata keys while making its add button open a useful restore menu. Introduce project-specific free-form priority values without changing the fixed priority syntax used by embedded Tasks lines.

**Tech Stack:** TypeScript, Obsidian API, Vitest, CSS, npm/esbuild, Obsidian CLI.

---

### Task 1: Native property menu and reference styling

**Files:**
- Modify: `src/integrations/builtin-property-editor.ts`
- Modify: `styles.css`
- Test: `tests/views/sidebar-group-actions.test.ts`
- Test: `tests/views/markdown-reference-renderer.test.ts`

- [x] **Step 1: Write failing source and DOM assertions** requiring one native menu shell and no underline for both reference classes.
- [x] **Step 2: Run the two focused tests** and verify they fail because a second menu is created and person links inherit native link decoration.
- [x] **Step 3: Append accessible plugin actions directly to the existing native action group** without creating a second menu.
- [x] **Step 4: Add reference CSS** with `text-decoration: none !important` for normal and hover states.
- [x] **Step 5: Re-run focused tests** and expect PASS.

### Task 2: Card marker placement

**Files:**
- Modify: `src/views/personal-view.ts`
- Test: `tests/views/task-type-presentation.test.ts`

- [x] **Step 1: Add a failing assertion** that personal dashboard project cards pass `markerBeforeKey: true`.
- [x] **Step 2: Run the test** and verify it fails on the current renderer call.
- [x] **Step 3: Enable key marker placement** for personal dashboard project cards.
- [x] **Step 4: Re-run the test** and expect PASS.

### Task 3: Unified project metadata editor

**Files:**
- Modify: `src/settings/template-field-editor.ts`
- Modify: `src/settings/template-editor.ts`
- Modify: `src/settings/task-field-configuration.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `styles.css`
- Test: `tests/settings/template-fields.test.ts`
- Test: `tests/views/task-dialog-layout.test.ts`

- [x] **Step 1: Add failing tests** proving there is one project metadata section/add menu, no separate custom-field heading/button, and no fixed custom-fields gate in project dialogs.
- [x] **Step 2: Run focused tests** and verify RED.
- [x] **Step 3: Pass the template into `TemplateFieldEditor`** so it can render built-in and custom definitions in one divided list.
- [x] **Step 4: Replace the add dropdown with one menu** containing disabled built-ins plus an always-available custom metadata action.
- [x] **Step 5: Move custom field editing controls** into the unified metadata list and remove the duplicated block from `template-editor.ts`.
- [x] **Step 6: Render active custom definitions directly in dialog metadata layout** without the fixed `customFields` form rule or an empty custom-field section.
- [x] **Step 7: Re-run focused tests** and expect PASS.

### Task 4: Configurable project priority options

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/settings/task-field-configuration.ts`
- Modify: `src/settings/template-field-editor.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `src/views/project-list-inline-editor.ts`
- Modify: `src/views/task-priority-presentation.ts`
- Modify: `src/views/task-card-fields.ts`
- Modify: `src/views/task-display-settings.ts`
- Modify: `src/settings/view-display-editor.ts`
- Test: `tests/settings/template-fields.test.ts`
- Test: `tests/domain/validation.test.ts`
- Test: `tests/views/task-priority-presentation.test.ts`

- [x] **Step 1: Add failing model tests** for normalized custom priority options and non-empty custom priority validation.
- [x] **Step 2: Add failing presentation assertions** for custom labels and template-driven dropdowns.
- [x] **Step 3: Run focused tests** and verify RED.
- [x] **Step 4: Separate project priority strings from fixed embedded-task priorities** and persist priority options on the priority field rule.
- [x] **Step 5: Add option add/edit/delete controls** to the unified priority metadata item, retaining at least one option.
- [x] **Step 6: Feed configured options through create/edit/list editors and card labels**, falling back safely for legacy values.
- [x] **Step 7: Preserve arbitrary configured priorities in quadrant settings normalization** and populate its choices from active templates/projects.
- [x] **Step 8: Re-run focused tests** and expect PASS.

### Task 5: Task metadata add menu

**Files:**
- Modify: `src/settings/task-metadata-settings-editor.ts`
- Test: `tests/settings/task-metadata-settings.test.ts`

- [x] **Step 1: Add a failing assertion** that the add button opens an Obsidian menu even when no task metadata is currently removable.
- [x] **Step 2: Run the focused test** and verify RED because the current button is disabled.
- [x] **Step 3: Render an anchored add menu** listing disabled supported fields, or a disabled explanatory item when all four are present.
- [x] **Step 4: Re-run the focused test** and expect PASS.

### Task 6: Regression, deployment, and runtime verification

**Files:**
- Modify only affected implementation/tests if a regression is found.

- [x] **Step 1: Run** `npm run lint`, `npm test`, and `npm run build:ci`; expect zero errors and all tests passing.
- [x] **Step 2: Deploy** with `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`.
- [x] **Step 3: Restart Obsidian** and verify `dev:errors` plus `dev:console level=error` are empty.
- [x] **Step 4: Inspect the property context menu DOM** and verify one `.menu` contains native delete plus both plugin actions.
