# Task Card and Inline Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven development for every behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep embedded task metadata inside compact project cards, let calendar cards size independently, replace project-dialog task Markdown inputs with structured task controls, and add safe inline metadata/field editing to task and list views.

**Architecture:** Preserve the existing Tasks-compatible Markdown storage and `EmbeddedSubtask` service as the source of truth. Add callback modes to the task dialogs so project dialogs can edit an unsaved Markdown draft, expose metadata items as buttons only when a surface supplies an edit callback, and isolate list-field mutation rules in a pure model before wiring DOM editors into the virtualized list renderer.

**Tech Stack:** TypeScript, Obsidian API, Vitest, CSS Grid/Flexbox, npm, esbuild, Obsidian CLI.

---

### Task 1: Compact embedded task layout and independent calendar heights

**Files:**
- Modify: `styles.css`
- Modify: `tests/views/card-layout.test.ts`
- Modify: `tests/views/embedded-subtask-presentation.test.ts`

- [ ] **Step 1: Write failing CSS contract tests**

Add assertions requiring `.op-calendar-task` to use `height: max-content` and `align-self: start`; require embedded task rows to have `min-width: 0`, `max-width: 100%`, transparent backgrounds, nowrap metadata, and clipped overflow.

- [ ] **Step 2: Verify the new tests fail**

Run: `npx vitest run tests/views/card-layout.test.ts tests/views/embedded-subtask-presentation.test.ts`

Expected: FAIL because calendar items still stretch and embedded metadata still wraps in a vertical grid.

- [ ] **Step 3: Implement scoped card CSS**

Change embedded task content to a single-line flex layout with a shrinking ellipsis title and nowrap metadata; keep the task row and button transparent. Add `height: max-content` and `align-self: start` to calendar cards so each item uses its own content height without changing span columns.

- [ ] **Step 4: Verify the focused tests pass**

Run: `npx vitest run tests/views/card-layout.test.ts tests/views/embedded-subtask-presentation.test.ts`

Expected: PASS.

### Task 2: Structured task controls inside project dialogs

**Files:**
- Create: `src/modals/subtask-list-editor.ts`
- Modify: `src/modals/create-subtask-modal.ts`
- Modify: `src/modals/edit-subtask-modal.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Create: `tests/modals/subtask-list-editor.test.ts`
- Modify: `tests/views/task-dialog-layout.test.ts`

- [ ] **Step 1: Write failing modal contract and draft-mutation tests**

Test that project dialogs call `renderSubtaskListEditor` and no longer attach `renderMarkdownEditor` to their task sections. Test pure draft helpers with `upsertEmbeddedSubtask` and `removeEmbeddedSubtask` so legacy Markdown remains intact while structured tasks are added, edited, or deleted.

- [ ] **Step 2: Verify the modal tests fail**

Run: `npx vitest run tests/modals/subtask-list-editor.test.ts tests/views/task-dialog-layout.test.ts`

Expected: FAIL because the helper and callback dialog modes do not exist.

- [ ] **Step 3: Add callback-capable task dialogs**

Allow `CreateSubtaskModal` to receive an `onCreate(EmbeddedSubtask)` callback and skip project selection in draft mode. Allow `EditSubtaskModal` to receive `onSave` and `onDelete` callbacks and use a supplied parent label when no persisted `IndexedTask` exists. Keep all existing manager-backed call sites working.

- [ ] **Step 4: Render current tasks and actions in project dialogs**

Implement `renderSubtaskListEditor(container, options)` to show current structured tasks, an edit button for each task, an **新增任务** button, and a non-editable notice for retained legacy Markdown. Update the create and edit project dialogs to mutate their local `subtasks` Markdown draft through the callback dialogs and rerender.

- [ ] **Step 5: Verify the modal tests pass**

Run: `npx vitest run tests/modals/subtask-list-editor.test.ts tests/views/task-dialog-layout.test.ts tests/services/embedded-subtask-service.test.ts`

Expected: PASS.

### Task 3: Task-view hero and inline task metadata editing

**Files:**
- Create: `src/views/task-metadata-inline-editor.ts`
- Modify: `src/views/task-metadata-presentation.ts`
- Modify: `src/views/task-view-model.ts`
- Modify: `src/views/task-view.ts`
- Modify: `styles.css`
- Create: `tests/views/task-metadata-inline-editor.test.ts`
- Modify: `tests/views/task-view-presentation.test.ts`

- [ ] **Step 1: Write failing editable-metadata model tests**

Test that only `priority`, `tags`, `scheduledDate`, `startDate`, and `dueDate` are inline editable and that editor values produce correctly typed `EmbeddedSubtask` patches. Add presentation assertions for a hero card and metadata edit buttons.

- [ ] **Step 2: Verify the task-view tests fail**

Run: `npx vitest run tests/views/task-metadata-inline-editor.test.ts tests/views/task-view-presentation.test.ts`

Expected: FAIL because metadata is rendered as passive spans and the header is not a hero card.

- [ ] **Step 3: Separate title and metadata interactions**

Render task-row content as a neutral container, place the title in its own button, and let `renderTaskMetadata` create metadata buttons when an `onEdit` callback is supplied. Preserve title click, title double-click, completion, source navigation, and legacy Markdown behavior.

- [ ] **Step 4: Implement inline metadata controls**

Use a select for priority and text/date inputs for tags and dates. On commit, reconstruct the structured `EmbeddedSubtask`, call `manager.updateEmbeddedSubtask`, and restore the previous content on Escape or save failure. Lifecycle dates, ID, and project remain read-only.

- [ ] **Step 5: Add the hero card presentation**

Reuse `.op-view-hero` on the task-view header and add task-view-specific spacing so the header card remains responsive above the collapsible shell.

- [ ] **Step 6: Verify the task-view tests pass**

Run: `npx vitest run tests/views/task-metadata-inline-editor.test.ts tests/views/task-view-model.test.ts tests/views/task-view-presentation.test.ts`

Expected: PASS.

### Task 4: Project-list task label, task editing, and field-level inline editing

**Files:**
- Create: `src/views/project-list-inline-editor.ts`
- Modify: `src/views/project-list-renderer.ts`
- Modify: `src/views/project-view.ts`
- Modify: `src/views/task-display-settings.ts`
- Modify: `styles.css`
- Create: `tests/views/project-list-inline-editor.test.ts`
- Modify: `tests/views/view-display-settings.test.ts`
- Modify: `tests/views/project-view-regressions.test.ts`

- [ ] **Step 1: Write failing list-editor model tests**

Test editor kinds and value application for title, priority, type, status, reporter, assignee, four date fields, tags, and active custom-field types. Assert that key, project, relations, links, and tasks are not replaced by scalar inline editors.

- [ ] **Step 2: Verify the list tests fail**

Run: `npx vitest run tests/views/project-list-inline-editor.test.ts tests/views/view-display-settings.test.ts tests/views/project-view-regressions.test.ts`

Expected: FAIL because no list field editor exists and the field label is still **子任务**.

- [ ] **Step 3: Implement safe list-field mutation**

Create typed editor descriptors and apply values to a cloned task document. Use `transitionTask` for status edits so completion/termination timestamps remain workflow-owned; normalize tags and custom values according to their configured field type.

- [ ] **Step 4: Wire double-click inline controls into list cells**

Mark editable cells, start an input/select/checkbox editor on double-click, stop row activation while editing, save with `manager.saveTask`, cancel on Escape, and retain the full project modal as the row fallback. Keep structured tasks clickable through the existing `EditSubtaskModal` renderer.

- [ ] **Step 5: Rename the list task field**

Change `TASK_DISPLAY_FIELD_LABELS.subtasks` and the list column definition from **子任务** to **任务**, without renaming the persisted field ID `subtasks` or the incomplete-task filter.

- [ ] **Step 6: Verify the list tests pass**

Run: `npx vitest run tests/views/project-list-inline-editor.test.ts tests/views/view-display-settings.test.ts tests/views/project-view-regressions.test.ts tests/views/embedded-subtask-presentation.test.ts`

Expected: PASS.

### Task 5: Full verification and deployment

**Files:**
- Modify: `tests/e2e/manual-checklist.md`

- [ ] **Step 1: Run all automated checks**

Run: `npm test`, `npx tsc --noEmit --skipLibCheck`, `npm run lint`, and `git diff --check`.

Expected: all tests and checks pass without errors.

- [ ] **Step 2: Build and deploy**

Run: `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`

Expected: production bundle succeeds and deploys to `D:\code\obsidian\test\.obsidian\plugins\obsidian-project`.

- [ ] **Step 3: Verify in Obsidian**

Cold-restart the `test` vault, confirm `obsidian dev:errors` and error-level console output are empty, then inspect calendar card heights, embedded metadata bounds/background, task-view hero and metadata editor, project-dialog task buttons, and list inline editors in the live DOM.

