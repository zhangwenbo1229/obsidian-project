# Project and Tasks View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven development for every behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the user-facing work-item hierarchy to groups/projects/tasks, store embedded tasks in Tasks-compatible Markdown, add configurable task metadata and a dedicated task view, and support four-date calendar ranges.

**Architecture:** Keep existing internal IDs and TypeScript domain names stable for compatibility, while centralizing user-facing terminology. Introduce a Tasks-line parser as the single source for dashboard todos, embedded tasks, migration, and the new task view. Add normalized task-metadata presentation settings to the configuration snapshot and route all embedded-task surfaces through one renderer.

**Tech Stack:** TypeScript, Obsidian API, esbuild, Vitest, npm, CSS, Obsidian CLI.

---

### Task 1: Tasks-compatible Markdown protocol and todo layout

**Files:**
- Create: `src/markdown/tasks-line-parser.ts`
- Modify: `src/markdown/embedded-subtask-parser.ts`
- Modify: `src/views/dashboard-modules/todo-model.ts`
- Modify: `src/views/dashboard-modules/todo-card.ts`
- Modify: `src/domain/types.ts`
- Test: `tests/markdown/tasks-line-parser.test.ts`
- Test: `tests/views/dashboard-todo-model.test.ts`

- [ ] Write failing tests for Tasks emoji dates, priorities, tags, IDs, completion dates, legacy `op-subtask` migration, metadata-preserving title edits, and plain checkbox fallback.
- [ ] Run targeted tests and confirm failures are caused by the missing shared parser.
- [ ] Implement parse/serialize/update helpers and migrate embedded task parsing to them.
- [ ] Split todo title from metadata and fix the checkbox/content grid.
- [ ] Run targeted tests and typecheck.

### Task 2: Task metadata settings and shared presentation

**Files:**
- Create: `src/settings/task-metadata-settings.ts`
- Create: `src/settings/task-metadata-settings-editor.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/settings/settings-navigation.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/views/embedded-subtask-presentation.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `src/domain/types.ts`
- Test: `tests/settings/task-metadata-settings.test.ts`
- Test: `tests/views/embedded-subtask-presentation.test.ts`

- [ ] Write failing normalization and visibility tests for icon/color/display settings.
- [ ] Implement defaults, normalization, import/export persistence, and the settings page.
- [ ] Add the todo-card metadata visibility toggle and shared metadata renderer.
- [ ] Verify project cards, personal dashboard cards, todo cards, and the new task view use the same presentation rules.

### Task 3: Dedicated task view

**Files:**
- Create: `src/views/task-view-model.ts`
- Create: `src/views/task-view.ts`
- Modify: `src/main.ts`
- Modify: `src/commands/command-ids.ts`
- Modify: `src/commands/register-commands.ts`
- Modify: `styles.css`
- Test: `tests/views/task-view-model.test.ts`
- Test: `tests/commands/command-registration.test.ts`

- [ ] Write failing tests for collecting structured and plain project checklists, stable source references, today/upcoming/overdue/completed grouping, filtering, and sorting.
- [ ] Implement the pure collection/grouping model.
- [ ] Build a dense two-pane Obsidian view with scope navigation, project groups, completion toggles, edit actions, search, and sorting.
- [ ] Register a stable open-task-view command and ribbon entry.
- [ ] Add responsive styles without nested cards or horizontal overflow.

### Task 4: Four-date project model and calendar ranges

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/markdown/task-parser.ts`
- Modify: `src/domain/validation.ts`
- Modify: `src/services/task-service.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `src/settings/task-field-configuration.ts`
- Modify: `src/views/task-display-settings.ts`
- Modify: `src/views/task-card-fields.ts`
- Modify: `src/views/task-field-presentation.ts`
- Modify: `src/views/selectors.ts`
- Test: `tests/markdown/task-parser.test.ts`
- Test: `tests/views/selectors.test.ts`

- [ ] Write failing round-trip tests for `scheduled-date`, `due-date`, `start-date`, and `end-date`, including old data migration.
- [ ] Write failing calendar tests for scheduled-to-due, start-to-end, reversed ranges, and single-day fallback.
- [ ] Implement the four fields across validation, dialogs, templates, filters, display configuration, and cards.
- [ ] Render calendar spans using scheduled/due first, then start/end.

### Task 5: User-facing terminology migration

**Files:**
- Create: `src/ui/terminology.ts`
- Modify: `src/commands/register-commands.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `src/modals/create-subtask-modal.ts`
- Modify: `src/modals/edit-subtask-modal.ts`
- Modify: `src/settings/*.ts`
- Modify: `src/views/*.ts`
- Modify: `README.md`
- Modify: `docs/user-guide.md`
- Test: `tests/views/terminology.test.ts`

- [ ] Write failing UI-copy tests for group/project/task terminology while asserting stable command IDs and storage keys.
- [ ] Replace user-facing task-document wording with project wording.
- [ ] Replace embedded-subtask wording with task wording and parent-task wording with project wording.
- [ ] Change the project-view summary to `N 个分组 · M 个项目` and remove instructional hero copy.
- [ ] Keep legacy Markdown headings readable while writing the new headings.

### Task 6: Demo data, regression hardening, and deployment

**Files:**
- Modify: `scripts/seed-demo.mjs`
- Modify: `tests/scripts/seed-demo.test.ts`
- Modify: `tests/e2e/manual-checklist.md`

- [ ] Add Tasks-format examples for today, upcoming, overdue, completed, scheduled/due spans, start/end spans, and plain checklists.
- [ ] Run targeted tests after each task, then `npm test`, `npm run lint`, `npx tsc -noEmit -skipLibCheck`, and `git diff --check`.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` and confirm deployment.
- [ ] Cold-restart Obsidian, verify commands/views/settings, inspect errors and console, and validate desktop/mobile DOM behavior.

## Self-Review

- All seven requested areas map to Tasks 1-6.
- Existing command IDs, task keys, UUIDs, and project files remain compatible.
- Old `op-subtask` content is read and migrated; normal Markdown checklists remain valid.
- Tasks-only metadata intentionally removes assignee and update-time fields from embedded tasks.
- Four-date storage is explicit; calendar precedence is deterministic.
