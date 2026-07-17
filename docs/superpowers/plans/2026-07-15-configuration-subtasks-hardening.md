# Configuration, Views, and Structured Subtasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make template field presentation consistent in every task surface, improve tag selection and configuration portability, harden startup/network/testing boundaries, and add metadata-aware subtasks stored inside their parent task Markdown file.

**Architecture:** Introduce pure presentation, tag-suggestion, configuration-transfer, request-policy, task-discovery, and embedded-subtask modules, then keep Obsidian-specific rendering and persistence at their edges. Existing task Markdown remains valid: legacy checklist content stays readable, while structured subtasks use a normal Markdown checkbox followed by a compact `op-subtask` HTML comment containing a stable UUID and metadata. Configuration import is validate-first and replace-on-confirm, with a rollback snapshot kept in memory until persistence verification succeeds.

**Tech Stack:** TypeScript, Obsidian API, esbuild, Vitest, npm, CSS, Obsidian CLI.

---

## File Map

- Create `src/views/task-field-presentation.ts`: resolve built-in/custom field icon and color for all views.
- Modify `src/views/task-card-fields.ts`: render every card field through the shared presentation model.
- Modify `src/views/project-view.ts`: use shared field rendering in list mode and delegate mode renderers.
- Create `src/views/project-view-list.ts`, `src/views/project-view-cards.ts`: extract list and board/calendar/quadrant rendering responsibilities.
- Modify `src/views/dashboard-modules/todo-card.ts`: remove source-path UI while retaining editing/completion behavior.
- Modify `src/settings/task-field-configuration.ts`, task dialogs, and labels: rename due date copy to `计划日期`.
- Rewrite `src/modals/grouped-tag-picker.ts`: left group radio list plus right searchable multi-select suggestions.
- Create `src/modals/tag-picker-model.ts`: pure group-scoped filtering and tag creation rules.
- Create `src/settings/configuration-transfer.ts`: versioned export envelope and strict import validation.
- Create `src/settings/configuration-transfer-editor.ts`: export/download, import/file-picker, preview, and confirm UI.
- Modify `src/settings/settings-navigation.ts`, `src/settings/settings-tab.ts`, `src/services/project-manager.ts`: configuration page and verified replacement API.
- Create `src/repositories/task-discovery.ts`: select task candidates using metadata cache before reading files.
- Modify `src/repositories/task-repository.ts`, `src/main.ts`, `src/services/project-manager.ts`: non-blocking/lazy startup index with bounded reads.
- Create `src/views/dashboard-modules/request-policy.ts`: HTTPS/private-host policy, timeout, cancellation, and request deduplication.
- Modify weather/news services and cards to use the request policy and cancel stale loads.
- Create `src/domain/embedded-subtask.ts`: metadata type, validation, and status model.
- Create `src/markdown/embedded-subtask-parser.ts`: parse/serialize structured checkbox lines while preserving legacy Markdown.
- Create `src/modals/create-subtask-modal.ts`, `src/modals/edit-subtask-modal.ts`: dedicated metadata-aware subtask dialogs.
- Modify `src/markdown/task-parser.ts`, `src/domain/types.ts`, `src/services/project-manager.ts`, and card rendering to persist and edit embedded subtasks in the parent file.
- Modify `src/commands/register-commands.ts`, `src/commands/command-ids.ts`: stable `create-subtask` command with parent task selection.
- Add behavioral tests under `tests/views`, `tests/settings`, `tests/repositories`, `tests/markdown`, `tests/services`, and `tests/commands`.

### Task 1: Unified field presentation and copy

- [ ] Add a failing behavioral test in `tests/views/task-field-presentation.test.ts` asserting `resolveTaskFieldPresentation(task, field)` returns template rules for built-in fields, custom-field presentation for `custom:*`, and the title color fallback for `title`.
- [ ] Run `npx vitest run tests/views/task-field-presentation.test.ts`; expect failure because the module does not exist.
- [ ] Implement `resolveTaskFieldPresentation` in `src/views/task-field-presentation.ts` and update card/list renderers so both labels and values receive `--op-field-color` and configured icons.
- [ ] Add DOM-oriented tests with the lightweight Obsidian element mock for personal cards and all four project modes; assert configured colors/icons and configured field order, not source strings.
- [ ] Update all user-facing `dueDate` labels from `计划完成日期`/`截止时间` to `计划日期`, while retaining `due-date` storage keys.
- [ ] Run the targeted tests and `npx tsc -noEmit -skipLibCheck`; expect pass.

### Task 2: Todo source removal and grouped tag autocomplete

- [ ] Add failing tests in `tests/views/dashboard-todo-presentation.test.ts` that render a todo and assert no source path/button is created while checkbox and double-click editing remain.
- [ ] Add failing pure-model tests in `tests/modals/tag-picker-model.test.ts` for default `未分组`, group-only suggestions, case-insensitive input filtering, already-selected removal, hierarchical root assignment, and new-tag creation in the selected group.
- [ ] Run both tests; expect the source UI assertion and missing tag model to fail.
- [ ] Remove `op-todo-source` rendering and the card setting that exposes `showSource`, preserving legacy config normalization without displaying it.
- [ ] Implement the two-column tag picker: radio group rail on the left, input/suggestion menu and selected chips on the right, keyboard Arrow/Enter/Escape support, and group assignment persistence for newly created root tags.
- [ ] Add responsive CSS that stacks the group rail above suggestions below 600px without nesting cards.
- [ ] Run targeted tests and typecheck; expect pass.

### Task 3: Four-mode display rules and list parity

- [ ] Replace source-string tests in `tests/views/view-display-settings.test.ts` with model/editor behavior tests for independent drafts, ordering, hide/add, restore default, and save-one-mode-without-losing-other-drafts.
- [ ] Add failing list presentation tests proving built-in and custom fields use the same icon/color resolver as board, calendar, quadrant, and personal task cards.
- [ ] Run the tests and confirm the list presentation test fails on the current direct `setText` path.
- [ ] Route list cells through shared field renderers and keep board/calendar/quadrant arrays independently persisted through `ProjectViewDisplaySettings`.
- [ ] Extract list and card mode render helpers from `project-view.ts` without changing filters, scroll synchronization, drag workflow, or calendar ranges.
- [ ] Run view tests and typecheck; expect pass.

### Task 4: Configuration import/export

- [ ] Add failing tests in `tests/settings/configuration-transfer.test.ts` for a versioned JSON envelope, normalization of legacy optional fields, malformed JSON rejection, unsupported future schema rejection, invalid project/reference rejection, and redaction option for weather API keys.
- [ ] Run the test; expect failure because transfer functions do not exist.
- [ ] Implement `exportConfiguration`, `parseConfigurationImport`, and `validateConfigurationImport` as pure functions. The envelope shape is `{ format: 'obsidian-project-configuration', version: 1, exportedAt, configuration }`.
- [ ] Add `ProjectManager.replaceConfiguration(snapshot)` that validates and normalizes before save, verifies the persisted reload, and restores the previous snapshot if verification fails.
- [ ] Add a `配置数据` settings page with icon buttons for download/export and file import, a summary preview (projects/templates/filters/cards/tags), explicit confirmation, and clear error copy.
- [ ] Add tests for settings navigation and rollback behavior, then run targeted tests and typecheck.

### Task 5: Startup, network, and UI regression hardening

- [ ] Add a failing task-discovery test proving files outside configured task directories are not read and metadata-cache candidates are preferred.
- [ ] Add a failing startup test proving view/command registration completes before the full index promise settles and views receive an indexing state notification.
- [ ] Implement lazy index initialization after lifecycle registration; bound reads to configured task roots and keep vault events queued until the initial index is ready.
- [ ] Add request-policy tests for HTTPS-only custom endpoints, localhost/private/link-local blocking, explicit timeout, cancellation, and same-URL in-flight deduplication.
- [ ] Implement `DashboardRequestPolicy` and inject it into weather/news services; abort stale card renders and convert timeout/security failures into concise local errors.
- [ ] Add DOM behavior tests for tag picker, settings transfer preview, display-field ordering, calendar field styles, todo editing, and embedded-subtask interactions. Keep existing source assertions only where they enforce packaging/release structure.
- [ ] Extract `ProjectManager` configuration/tag/migration operations into focused services and dashboard settings renderers out of `module-settings.ts`, preserving public manager methods as delegating compatibility APIs.
- [ ] Run startup, request, UI, service, full tests, lint, and typecheck.

### Task 6: Structured embedded subtasks

- [ ] Add failing tests in `tests/markdown/embedded-subtask-parser.test.ts` for parsing and serializing this compatible representation:

```markdown
- [ ] 编写发布说明 <!-- op-subtask: {"id":"550e8400-e29b-41d4-a716-446655440000","priority":"high","assigneeId":null,"dueDate":"2026-07-20T18:00:00+08:00","tags":["release"]} -->
```

- [ ] Cover completed state, escaped titles, missing/invalid comments treated as legacy Markdown, duplicate IDs rejected, and unknown Markdown lines preserved byte-for-byte.
- [ ] Implement `EmbeddedSubtask` with `id`, `title`, `completed`, `priority`, `assigneeId`, `startDate`, `dueDate`, `tags`, `createdAt`, and `updatedAt`; parse it from `## 子任务` without changing the parent task schema or file location.
- [ ] Add service tests for create/update/toggle/delete operations that modify only the parent task document and preserve unrelated Markdown/frontmatter.
- [ ] Implement manager APIs `createEmbeddedSubtask(parent, input)`, `updateEmbeddedSubtask`, `toggleEmbeddedSubtask`, and `deleteEmbeddedSubtask` through `TaskRepository.save`.
- [ ] Add dedicated create/edit modals with title, priority, assignee, start date, plan date, tags, completion state, and delete confirmation; reuse the grouped tag picker.
- [ ] Register stable command ID `create-subtask`; when a project task file is active use it as parent, otherwise show a searchable parent-task selector. Disable the command when no valid parent exists.
- [ ] Render structured subtasks with checkbox, configured metadata, edit action, and immediate source-file synchronization; continue rendering legacy Markdown checklists through `MarkdownRenderer`.
- [ ] Run parser, service, command, modal, and view tests; expect pass.

### Task 7: Verification, deployment, and documentation

- [ ] Update `docs/user-guide.md`, `README.md`, and `tests/e2e/manual-checklist.md` for configuration transfer, grouped tag input, lazy indexing, network restrictions, and structured subtasks.
- [ ] Run `npm test`, `npm run lint`, `npx tsc -noEmit -skipLibCheck`, and `git diff --check`; expect all pass.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`; expect esbuild success and deployment to the test plugin directory.
- [ ] Reload with `obsidian plugin:reload id=obsidian-project`, inspect `obsidian dev:errors` and error-level console output, and capture desktop/mobile screenshots of calendar field colors, grouped tags, configuration transfer, and structured subtask dialogs.
- [ ] Confirm no generated `main.js` is committed, review the diff for unrelated changes, and commit the feature branch in coherent units.

## Self-Review

- All eight requested areas map to Tasks 1-6; deployment and runtime verification map to Task 7.
- Storage keys remain compatible: `due-date` is not renamed, legacy todo `showSource` is ignored, old dashboard/view settings normalize, and plain Markdown subtasks remain valid.
- Import cannot partially replace configuration: validation precedes persistence and failed verification rolls back.
- Network cards remain opt-in and gain stricter behavior without introducing additional services or telemetry.
- Large modules are split only along responsibilities touched by this work; public behavior and manager entry points remain stable.
