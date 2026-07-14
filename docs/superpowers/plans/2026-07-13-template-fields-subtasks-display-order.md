# Template Fields, Subtasks, And Display Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make task templates configure every user-editable task field, add Markdown subtasks and selectable note authors, and provide ordered field rendering across personal and project views.

**Architecture:** Add normalized per-task-type field rules while preserving legacy templates as fully enabled. Extend `TaskDocument` with an optional Markdown subtask body and serialize it as a backward-compatible `## 子任务` section. Centralize display-field ordering and task-card field rendering so list columns, personal cards, board, calendar, and quadrant cards consume the configured order consistently.

**Tech Stack:** TypeScript, Obsidian Modal/Setting/Menu APIs, MarkdownRenderer-compatible text surfaces, HTML drag and drop, CSS Grid, Vitest, esbuild.

---

### Task 1: Template field rules and defaults

**Files:** `src/domain/types.ts`, `src/settings/task-field-configuration.ts`, `src/settings/template-field-editor.ts`, `src/settings/template-editor.ts`, `src/settings/configuration-store.ts`, `tests/settings/template-fields.test.ts`, `tests/settings/configuration-store.test.ts`

- [x] Add tests requiring normalized rules for `title`, `priority`, `reporter`, `assignee`, `startDate`, `dueDate`, `tags`, `body`, `links`, `subtasks`, `relations`, `notes`, and `customFields`; legacy templates must normalize every field to enabled.
- [x] Run the template tests and verify the field-rule model and editor are absent.
- [x] Add `TaskFormField`, `TaskFieldRule`, and optional `fieldConfig` to `TaskTypeDefinition`; implement `normalizeTaskFieldConfig`, `taskFieldEnabled`, `taskFieldRequired`, and default-value resolution.
- [x] Add a focused template field editor with enabled/required controls and field-appropriate defaults; extend custom-field editing to configure active state, defaults, and select options.
- [x] Normalize template field rules while loading plugin configuration and rerun the tests.

### Task 2: Markdown subtasks and related-only relationships

**Files:** `src/domain/types.ts`, `src/markdown/task-parser.ts`, `src/repositories/task-repository.ts`, `src/services/task-service.ts`, `tests/markdown/task-parser.test.ts`, `tests/repositories/repositories.test.ts`, `tests/services/task-service.test.ts`

- [x] Add failing round-trip tests for an optional `## 子任务` Markdown section and tests proving legacy Markdown without the section remains valid.
- [x] Add failing task-service tests for selectable reporter/note author, Markdown subtasks, and related-task creation.
- [x] Extend `TaskDocument` with optional `subtasks`, parse and serialize the section, and merge concurrent subtask edits independently.
- [x] Extend `NewTaskInput` with reporter, note author, subtasks, and related relations; preserve historical parent relations during parsing but do not create new ones.
- [x] Rerun Markdown, repository, and task-service tests.

### Task 3: Create and edit task forms

**Files:** `src/modals/create-task-modal.ts`, `src/modals/edit-task-modal.ts`, `src/services/task-field-validation.ts`, `tests/views/task-dialog-layout.test.ts`, `tests/services/task-field-validation.test.ts`

- [x] Add failing tests requiring a subtask Markdown editor below links, selectable note author controls, related-only relationship controls, and configured field visibility/required validation.
- [x] Implement a pure required-field validator for configured task fields and verify it independently.
- [x] Apply task-type defaults and visibility in create mode; pass reporter, note author, subtasks, and related relations to task creation.
- [x] Apply field visibility in edit mode, remove the parent relation selector and parent-assignment code, preserve unseen legacy parent relations, and add selectable authors for new notes.
- [x] Rerun dialog and validation tests.

### Task 4: Ordered display-field configuration

**Files:** `src/domain/types.ts`, `src/views/task-display-settings.ts`, `src/views/display-field-order.ts`, `src/settings/sortable-display-fields.ts`, `src/settings/view-display-editor.ts`, `src/modals/dashboard-card-settings-modal.ts`, `tests/views/display-field-order.test.ts`, `tests/views/view-display-settings.test.ts`, `tests/views/personal-layout.test.ts`

- [x] Add failing tests for `relations`, `links`, and `subtasks`, stable normalization order, and `reorderTaskDisplayFields`.
- [x] Add structural tests requiring four view-display subpages and draggable field rows in view and personal-card settings.
- [x] Extend the field catalog and defaults, implement the pure reorder helper, and build a reusable draggable field editor with add/remove controls.
- [x] Convert “视图显示” to four segmented subpages and use the sortable editor in every page; use the same editor for each personal task-list card.
- [x] Rerun display-order and settings tests.

### Task 5: Ordered card rendering and priority presentation

**Files:** `src/views/task-priority-presentation.ts`, `src/views/task-card-fields.ts`, `src/views/personal-view.ts`, `src/views/project-view.ts`, `styles.css`, `tests/views/task-priority-presentation.test.ts`, `tests/views/view-display-settings.test.ts`

- [x] Add failing tests requiring the board, calendar, and quadrant renderers to call one priority-pill renderer and requiring card fields to follow configuration order.
- [x] Add a shared priority renderer using `op-priority is-high|is-medium|is-low` and Chinese labels.
- [x] Add ordered field rendering for key, title, project, type, status, priority, people, dates, tags, custom fields, relationships, links, and subtasks.
- [x] Use the shared renderer in personal task cards and the three project card modes; retain card click, keyboard, and board drag behavior.
- [x] Make list columns follow configured order, expanding custom fields at the `customFields` position, and rerun view tests.

### Task 6: Filter spacing and horizontal list scrolling

**Files:** `styles.css`, `src/views/project-view.ts`, `tests/views/project-filter-fields.test.ts`, `tests/views/column-widths.test.ts`

- [x] Add failing style/source tests requiring wider filter tracks, larger row/column gaps, and an explicit pixel table width based on visible columns.
- [x] Increase filter-panel spacing and minimum field width without reintroducing checkbox overflow.
- [x] Set the list table width to the sum of configured column widths with `min-width: 100%`, and retain `overflow-x: auto` on `.op-list-scroll`.
- [x] Rerun filter and list-width tests.

### Task 7: Verification and deployment

**Files:** all changed files; deployment target `D:/code/obsidian/test/.obsidian/plugins/obsidian-project/`

- [x] Run all targeted tests, then `npm test`, `npx tsc --noEmit --skipLibCheck`, `npm run lint`, and `git diff --check`.
- [x] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` so the successful build automatically deploys.
- [x] Compare SHA-256 hashes for `main.js`, `manifest.json`, and `styles.css`; reload the plugin and check Obsidian errors and console output once.
