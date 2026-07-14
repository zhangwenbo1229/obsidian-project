# Data Configuration, Jira Filters, Tag Editing, and Task Dialog Implementation Plan

> **For agentic workers:** Implement inline in this session with failing tests before each behavior change. A successful build must deploy to the test Vault.

**Goal:** Move all configuration into plugin data, make filtering progressive, support global tag rename/order, and replace native-looking task forms with a designed plugin dialog.

**Architecture:** Introduce a configuration store injected into `ProjectManager`; migrate legacy Markdown configuration once and delete it only after verified persistence. Keep tag changes as an explicit batch plan over indexed task documents. Keep Obsidian Modal lifecycle for focus/accessibility while rendering a fully custom shell and fields.

**Tech Stack:** TypeScript, Obsidian API, CSS, Vitest, npm, esbuild.

---

### Task 1: Plugin-data configuration store

**Files:** `src/settings/plugin-data-store.ts`, `src/main.ts`, `src/services/project-manager.ts`, `src/settings/settings-tab.ts`, repository tests and manager tests.

- [x] Test empty-store defaults, legacy import, verified save-before-delete, and reload from plugin data.
- [x] Inject load/save callbacks into the manager and remove runtime dependence on global/project Markdown repositories.
- [x] Rewrite create/save/delete/project-code/custom-field operations to persist one configuration snapshot.
- [x] Remove obsolete path settings and file watchers for configuration Markdown.

### Task 2: Progressive Jira filter builder

**Files:** `src/views/project-view.ts`, `src/views/project-filter-fields.ts`, `tests/views/project-filter-fields.test.ts`, `styles.css`.

- [x] Test available/selected filter-field state and removal behavior.
- [x] Add a compact field picker beside the search input.
- [x] Render only selected filter controls under the search bar and preserve values for the session.

### Task 3: Tag rename and drag ordering

**Files:** `src/services/tag-service.ts`, `tests/services/tag-service.test.ts`, `src/services/project-manager.ts`, `src/views/personal-view.ts`, `src/settings/plugin-data-store.ts`, `styles.css`.

- [x] Test parent-path rename cascading, collision deduplication, and stable custom order.
- [x] Batch-save every affected task before updating the persistent tag order.
- [x] Open a compact rename editor on double-click and support tree-node drag/drop ordering.

### Task 4: Designed task dialogs

**Files:** `src/modals/task-dialog.ts`, `src/modals/create-task-modal.ts`, `src/modals/edit-task-modal.ts`, `styles.css`, structural UI tests.

- [x] Add a reusable custom task-dialog shell inside the Obsidian modal lifecycle.
- [x] Group identity, scheduling, people, custom fields, body, relations, and notes into designed sections.
- [x] Provide desktop two-column and mobile full-screen layouts with explicit close/save actions.

### Task 5: Verification and deployment

- [x] Run all tests, type checking, lint, diff checks, and encoding scan.
- [x] Build with the test Vault environment and automatically deploy.
- [ ] Verify migration removes legacy configuration files, settings persist after reload, tag rename updates task files, filters are progressive, dialogs are styled, and console errors remain zero.
