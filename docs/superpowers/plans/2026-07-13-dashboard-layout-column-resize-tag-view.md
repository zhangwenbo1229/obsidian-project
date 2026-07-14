# Dashboard Layout, Resizable Project Tables, and Tag View Implementation Plan

> **For agentic workers:** Implement inline in this session. Use failing Vitest tests before each behavior change. A successful production build must automatically deploy.

**Goal:** Replace the personal filter sidebar with a configurable card workspace, refine project filtering and table/quadrant presentation, make templates task-type scoped, and add a dedicated tag management sidebar view.

**Architecture:** Persist dashboard card order, grid spans, and optional saved-filter bindings in plugin configuration. Keep project filtering semantics unchanged while rendering selections as checkbox menus and persisting list-column widths in view state. Preserve template storage compatibility by enforcing one task type per catalog entry and combining enabled template entries into the existing project runtime fields.

**Tech Stack:** TypeScript, Obsidian API, HTML drag/drop, CSS Grid resize handles, Vitest, npm, esbuild, Obsidian CLI.

---

### Task 1: Personal dashboard layout model

**Files:** `src/domain/types.ts`, `src/settings/configuration-store.ts`, `src/services/project-manager.ts`, `src/views/dashboard-layout.ts`, `tests/views/dashboard-layout.test.ts`.

- [ ] Test default card layout normalization, reorder, resize-span clamping, and saved-filter binding.
- [ ] Add `PersonalDashboardCardLayout` entries to the configuration snapshot.
- [ ] Implement pure layout helpers and manager persistence.
- [ ] Run the targeted layout test.

### Task 2: Personal view card workspace

**Files:** `src/views/personal-view.ts`, `styles.css`, `tests/views/personal-layout.test.ts`.

- [ ] Add a failing structural test proving the sidebar is removed and dashboard cards are draggable, resizable, and context-menu aware.
- [ ] Render five statistic cards plus overdue and pending cards from the persisted order.
- [ ] Bind each card to an optional saved filter through an Obsidian `Menu` opened on `contextmenu`.
- [ ] Persist drag reorder and grid spans after resizing.
- [ ] Run personal layout and selector tests.

### Task 3: Project filters and list columns

**Files:** `src/views/project-view.ts`, `src/views/multi-select-filter.ts`, `src/views/column-widths.ts`, `styles.css`, `tests/views/project-filter-fields.test.ts`, `tests/views/column-widths.test.ts`.

- [ ] Test checkbox multi-select behavior and column-width clamping.
- [ ] Replace scrolling `<select multiple>` controls with compact checkbox menus.
- [ ] Remove the list-field picker.
- [ ] Add pointer-driven resize handles to list headers and apply stored widths to headers/cells.
- [ ] Run targeted project-view tests.

### Task 4: Quadrant task cards

**Files:** `src/views/project-view.ts`, `styles.css`, `tests/views/card-layout.test.ts`.

- [ ] Add a failing CSS/structure test for quadrant cards.
- [ ] Replace quadrant tables with compact task cards showing key, priority, due date, title, status, assignee, and tags.
- [ ] Verify all four regions remain independently scrollable.

### Task 5: One template per task type

**Files:** `src/domain/types.ts`, `src/services/template-service.ts`, `src/services/project-manager.ts`, `src/settings/template-editor.ts`, `src/modals/project-config-modal.ts`, `src/settings/configuration-store.ts`, `scripts/seed-demo.mjs`, related tests.

- [ ] Test that enabled single-type templates merge task types and custom fields, and that the first template supplies workflow.
- [ ] Add `templateIds` to projects and normalize legacy `templateId`.
- [ ] Change template settings to a top list/bottom editor layout and remove multi-type editing.
- [ ] Let projects enable multiple task-type templates with checkboxes.
- [ ] Rebuild demo templates as task, bug, and requirement catalog entries.

### Task 6: Task-type body switching

**Files:** `src/services/task-service.ts`, `src/modals/create-task-modal.ts`, `src/modals/edit-task-modal.ts`, `tests/services/task-service.test.ts`.

- [ ] Test per-type draft preservation and template fallback.
- [ ] Store an in-dialog body draft per task type.
- [ ] On type changes, restore that type's draft or its configured template without losing the prior type's text.
- [ ] Run task-service and dialog tests.

### Task 7: Obsidian tag management sidebar

**Files:** `src/views/tag-management-view.ts`, `src/main.ts`, `src/commands/command-ids.ts`, `src/commands/register-commands.ts`, `styles.css`, command/tag tests.

- [ ] Add failing tests for view registration and the double-click rename surface.
- [ ] Register a tag-management view and open it in the right sidebar by default.
- [ ] Render the hierarchical tag tree with counts and double-click inline editing.
- [ ] Reuse `manager.renameTag` so parent renames cascade through every prior task tag.

### Task 8: Live Markdown preview assessment

**Files:** `docs/live-markdown-preview-assessment.md`.

- [ ] Document feasibility, Obsidian `MarkdownRenderer` and CodeMirror options, mobile/performance considerations, and a recommended phased approach.
- [ ] Do not change the current task input behavior.

### Task 9: Verification and deployment

- [ ] Run all tests, TypeScript, lint, encoding scan, and `git diff --check`.
- [ ] Build with `OBSIDIAN_VAULT_PATH=D:\\code\\obsidian\\test`; deploy automatically after successful compilation.
- [ ] Reload the plugin and inspect card drag/resize, filter binding, checkbox filters, column resize, quadrant cards, template layout, type switching, and tag rename.
- [ ] Check runtime errors, console errors, demo data, and deployed artifact hashes.
