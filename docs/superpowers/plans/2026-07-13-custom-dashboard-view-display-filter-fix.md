# Custom Dashboard, View Display, And Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix invisible project-filter choices, support per-card custom dashboard definitions, and add persisted project-mode field visibility settings.

**Architecture:** Narrow filter input sizing so checkbox controls retain intrinsic width. Extend the dashboard layout record with card kind, metric, saved-filter source, and task-field visibility while preserving all built-in cards and legacy configuration. Store one normalized project-view display configuration in plugin data and let each renderer select fields from it.

**Tech Stack:** TypeScript, Obsidian Settings/Modal/Menu APIs, CSS Grid, Vitest, esbuild.

---

### Task 1: Checkbox visibility regression

**Files:** `styles.css`, `tests/views/project-filter-fields.test.ts`

- [x] Add a failing CSS regression test that rejects `.op-filter-field input { width: 100% }`, requires `input:not([type='checkbox'])`, and fixes checkbox dimensions.
- [x] Run `npm test -- tests/views/project-filter-fields.test.ts` and verify the screenshot root cause is reproduced by the selector assertion.
- [x] Narrow the width selector to text/date/select inputs and explicitly size multi-select checkboxes to 16px; rerun the test.

### Task 2: Dashboard card definition model

**Files:** `src/domain/types.ts`, `src/views/task-display-settings.ts`, `src/views/dashboard-layout.ts`, `tests/views/dashboard-layout.test.ts`

- [x] Add failing tests that legacy defaults receive number/percentage/task-list kinds and that arbitrary custom card IDs survive normalization.
- [x] Add tests for `createDashboardCard`, `updateDashboardCard`, and `deleteDashboardCard` with per-card metric/filter/field settings.
- [x] Run the dashboard tests and confirm the fixed-ID normalizer drops custom cards.
- [x] Add card kinds (`number`, `percentage`, `task-list`), metrics, saved-filter source, number color, and per-card display fields; normalize legacy cards and preserve custom definitions.
- [x] Re-run dashboard model tests.

### Task 3: Custom card creation and rendering

**Files:** `src/views/personal-view.ts`, `src/modals/dashboard-card-settings-modal.ts`, `styles.css`, `tests/views/personal-layout.test.ts`

- [x] Add failing structural tests for workspace right-click creation, custom-card deletion, metric rendering, and field-aware task-list rendering.
- [x] Run personal-view tests and verify custom card actions are absent.
- [x] Add a workspace context menu with number/percentage/task-list commands, create UUID-backed cards, and open each new card in its configuration modal.
- [x] Extend the card modal with type, metric, saved-filter data source, title/color, and task-list field checkboxes; permit deletion only for custom cards.
- [x] Render every card through its saved definition and conditionally emit task metadata fields; rerun personal-view tests.

### Task 4: Persisted project view display settings

**Files:** `src/domain/types.ts`, `src/views/task-display-settings.ts`, `src/settings/configuration-store.ts`, `src/services/project-manager.ts`, `tests/settings/configuration-store.test.ts`, `tests/views/view-display-settings.test.ts`

- [x] Add failing tests for normalized defaults covering list, board, calendar, and quadrants, and for legacy snapshots gaining `projectViewDisplay`.
- [x] Run the new settings tests and verify the configuration is missing.
- [x] Define common task display fields/Chinese labels, default field sets per mode, and a normalizer that ignores unknown/duplicate fields.
- [x] Add manager state, snapshot persistence, and `saveProjectViewDisplay`; rerun configuration tests.

### Task 5: “视图显示” settings page

**Files:** `src/settings/settings-navigation.ts`, `src/settings/settings-tab.ts`, `src/settings/view-display-editor.ts`, `styles.css`, `tests/settings/settings-navigation.test.ts`, `tests/settings/settings-layout.test.ts`

- [x] Add failing tests requiring the fifth `view-display` page, its icon/label, four mode panels, and checkbox controls.
- [x] Run settings tests and verify the page is absent.
- [x] Build a dedicated editor with tabs/sections for list, board, calendar, and quadrants, using the common Chinese field labels and one save command.
- [x] Register the page in navigation and persist through the manager; rerun settings tests.

### Task 6: Apply field visibility in all project modes

**Files:** `src/views/project-view.ts`, `styles.css`, `tests/views/view-display-settings.test.ts`, `tests/views/task-type-presentation.test.ts`

- [x] Add failing source tests that each renderer reads `projectViewDisplay` and conditionally renders configured fields.
- [x] Run project-view tests and confirm all modes still hard-code metadata.
- [x] Filter list columns, board metadata/tags, calendar key/type/project labels, and quadrant priority/dates/status/assignee/tags through the mode field set.
- [x] Keep task click/drag behavior independent of hidden fields and rerun all view tests.

### Task 7: Verification and deployment

**Files:** all changed files; deployment target `D:/code/obsidian/test/.obsidian/plugins/obsidian-project/`

- [x] Run `npm test`, `npx tsc -noEmit -skipLibCheck`, `npm run lint`, and `git diff --check`.
- [x] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` to compile and automatically deploy.
- [x] Compare SHA-256 hashes for all deployed artifacts, reload the plugin once, and check the Obsidian error buffer once.
