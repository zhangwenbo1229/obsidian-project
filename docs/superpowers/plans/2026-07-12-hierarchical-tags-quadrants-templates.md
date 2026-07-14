# Hierarchical Tags, Quadrants, and Template Settings Implementation Plan

> **For agentic workers:** Implement inline in this session. Every behavior change starts with a failing Vitest regression test; do not commit generated artifacts.

**Goal:** Refine the personal dashboard, add an Eisenhower-style project table mode, and simplify configuration navigation and task templates.

**Architecture:** Add pure tag-tree and quadrant selector models, keep legacy project/task Markdown readable, and write priority/default template state through existing repositories. Settings remain one Obsidian settings tab with horizontal page navigation and a dedicated fixed-template page.

**Tech Stack:** TypeScript, Obsidian API, CSS, Vitest, npm, esbuild.

---

### Task 1: Hierarchical personal tags

**Files:** `tests/views/selectors.test.ts`, `src/views/selectors.ts`, `src/views/personal-view.ts`, `styles.css`

- [ ] Test that slash-separated tags build a stable tree and parent selection matches descendants.
- [ ] Implement the tree builder and hierarchical tag matching.
- [ ] Render nested tag branches with accessible checkboxes.
- [ ] Make the sidebar pure white with readable light-surface tokens in both Obsidian themes.

### Task 2: Compact personal task cards

**Files:** `tests/views/card-layout.test.ts`, `src/views/personal-view.ts`, `styles.css`

- [ ] Add a structural test for a three-row card layout.
- [ ] Merge key/status/date, title, and project/assignee/tags into three rows.
- [ ] Verify both personal panels use the same compact renderer without overflow.

### Task 3: Built-in priority and quadrant mode

**Files:** `tests/markdown/task-parser.test.ts`, `tests/services/task-service.test.ts`, `tests/views/selectors.test.ts`, `src/domain/types.ts`, `src/domain/validation.ts`, `src/markdown/task-parser.ts`, `src/services/task-service.ts`, `src/modals/create-task-modal.ts`, `src/modals/edit-task-modal.ts`, `src/views/selectors.ts`, `src/views/project-view.ts`, `styles.css`

- [ ] Test legacy priority defaulting, priority round-trip, and new-task default priority.
- [ ] Test four-quadrant classification: high is important; due through today + 3 days is urgent; missing/later due dates are not urgent.
- [ ] Add graphical priority inputs to create/edit task forms.
- [ ] Add a fourth project-view mode with four region tables sorted by due date then start date.

### Task 4: Fixed template settings and horizontal configuration

**Files:** `tests/settings/settings-navigation.test.ts`, `tests/services/task-service.test.ts`, `src/constants.ts`, `src/services/task-service.ts`, `src/settings/settings-navigation.ts`, `src/settings/settings-tab.ts`, `src/modals/project-config-modal.ts`, `scripts/seed-demo.mjs`, `styles.css`

- [ ] Test navigation to the template page and fixed-template resolution.
- [ ] Remove template text editing from project detail.
- [ ] Add a task-template page with project selection and task/bug/requirement enable toggles.
- [ ] Hide personnel UUIDs and use names as row labels.
- [ ] Replace left/right settings navigation with an upper tab strip and lower content area.

### Task 5: Verification and deployment

**Files:** all modified sources and deployed release artifacts.

- [ ] Run targeted tests, all tests, type checking, lint, and `git diff --check`.
- [ ] Build with the test Vault environment so the successful build automatically deploys.
- [ ] Hot reload the plugin and inspect personal tags/cards, all four quadrant tables, template settings, and mobile layout.
- [ ] Confirm zero runtime errors and matching source/deployed hashes.
