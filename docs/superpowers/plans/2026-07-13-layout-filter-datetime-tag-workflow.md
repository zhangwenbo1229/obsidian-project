# Layout, Filter, Date-Time, Tag, And Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate dashboard and filter interaction defects, add date-time task scheduling, enable native tag reparenting, strengthen template visual configuration, and add an all-project workspace.

**Architecture:** Replace CSS-native dashboard resizing with grid-span pointer interactions so rendered size and occupied grid space cannot diverge. Preserve expanded filter state across renders and keep option panels in document flow. Store new schedule values as zoned date-times while accepting legacy date-only values, and centralize date-only comparisons for calendar/statistics. Extend the native Tags-pane integration with path-based drag reparenting, and make workflow nodes movable/connectable while retaining form editing for precise metadata.

**Tech Stack:** TypeScript, Obsidian API, DOM pointer/drag events, CSS Grid/SVG workflow edges, Vitest, esbuild.

---

### Task 1: Collision-free dashboard resizing

**Files:** `src/views/personal-view.ts`, `styles.css`, `tests/views/personal-layout.test.ts`, `tests/views/dashboard-layout.test.ts`

- [x] Add a failing structural test requiring `.op-dashboard-resize-handle`, pointer capture, and the absence of CSS `resize: both`.
- [x] Run `npm test -- tests/views/personal-layout.test.ts tests/views/dashboard-layout.test.ts` and confirm the old native resize implementation fails.
- [x] Render a diagonal resize handle, calculate clamped grid spans from pointer movement, display the pending span through `data-resize-preview`, then persist and re-render only on pointer release.
- [x] Add `min-width: 0`, `box-sizing: border-box`, and grid-contained overflow rules; re-run the dashboard tests.

### Task 2: Reliable progressive filters and all-project scope

**Files:** `src/views/project-view.ts`, `src/views/selectors.ts`, `styles.css`, `tests/views/project-filter-fields.test.ts`, `tests/views/selectors.test.ts`

- [x] Add failing tests for the `*` all-project scope, a persistent expanded multi-select identifier, flow-positioned options, and an “全部项目” selector option.
- [x] Run the two targeted tests and verify the current exact-project selector and absolute popup fail.
- [x] Add `ALL_PROJECTS_UID = '*'`, skip project UID filtering for that value, aggregate filter choices across active projects, render all-project hero counts, and use category columns for the all-project board.
- [x] Store the expanded filter control key on `toggle`, restore `details.open` after checkbox renders, and make the options panel participate in layout instead of being clipped behind task content.
- [x] Re-run the filter and selector tests.

### Task 3: List key marker and enforced title color

**Files:** `src/views/project-view.ts`, `src/views/task-type-presentation.ts`, `styles.css`, `tests/views/task-type-presentation.test.ts`

- [x] Add failing tests requiring the list key cell to call `renderTaskMarker` and title color to use an explicit CSS custom property with an overriding title rule.
- [x] Run the presentation test and confirm both behaviors are absent.
- [x] Split marker rendering from title rendering, place only the marker before the Key value, omit it from the list title cell, and expose `--op-task-title-color` on every rendered title.
- [x] Re-run presentation tests across personal, list, board, calendar, and quadrants.

### Task 4: Zoned date-time task scheduling and two-column custom fields

**Files:** `src/domain/types.ts`, `src/domain/validation.ts`, `src/domain/workflow.ts`, `src/utils/dates.ts`, `src/views/selectors.ts`, `src/modals/create-task-modal.ts`, `src/modals/edit-task-modal.ts`, `styles.css`, relevant domain/view tests.

- [x] Add failing tests that accept zoned schedule date-times, keep legacy dates valid, set workflow start time with an offset, render built-in schedule inputs as `datetime-local`, and require a two-column custom-field grid.
- [x] Run the date, validation, workflow, selector, and dialog tests and verify the new expectations fail.
- [x] Introduce a schedule value union (`IsoDate | IsoDateTime`), validate either representation, convert all create/edit built-in schedule controls through `toDateTimeLocalInput`/`fromDateTimeLocalInput`, and set workflow start with `localDateTime`.
- [x] Normalize comparisons through `datePart(value)` so overdue, quadrant, personal period, range, and calendar behavior remains correct for both formats.
- [x] Apply a responsive two-column grid to the custom-field section and re-run targeted tests.

### Task 5: Native Tags-pane drag reparenting

**Files:** `src/services/tag-service.ts`, `src/integrations/builtin-tag-editor.ts`, `styles.css`, `tests/services/tag-service.test.ts`, `tests/views/tag-management-view.test.ts`

- [x] Add a failing pure test for `reparentTagPath`: move below a parent, move to root, and reject self/descendant cycles.
- [x] Run the tag tests and verify the helper/integration is missing.
- [x] Mark built-in tag rows draggable on pointer interaction, transfer the source path on drag start, rename to `target/basename` on row drop, and rename to `basename` on tag-container drop.
- [x] Reject cycles/collisions, expose drag-over feedback, reuse `ProjectManager.renameTag` for descendant migration, and re-run tag tests.

### Task 6: Graphical marker picker, Chinese field types, and editable workflow graph

**Files:** `src/modals/task-marker-picker-modal.ts`, `src/settings/template-editor.ts`, `src/settings/workflow-editor.ts`, `src/settings/workflow-layout.ts`, `styles.css`, `tests/settings/template-editor.test.ts`, `tests/settings/workflow-layout.test.ts`

- [x] Add failing tests for a graphical marker picker, Chinese custom-field labels, saved status positions, and duplicate-safe graph connections.
- [x] Run settings tests and confirm the controls/helpers are absent.
- [x] Add a searchable icon/emoji grid modal that previews every choice and writes the selected marker.
- [x] Replace raw custom-field type labels with a complete Chinese label map while retaining stable stored IDs.
- [x] Render workflow statuses on a dotted stage using saved positions, draw SVG arrow edges, allow pointer dragging, and let a connect handle create a transition by selecting a destination; retain forms for names/categories/deletion.
- [x] Re-run settings/workflow tests.

### Task 7: Regression, build, deployment, and runtime check

**Files:** all changed files; deployment target `D:/code/obsidian/test/.obsidian/plugins/obsidian-project/`

- [x] Run `npm test`, `npx tsc -noEmit -skipLibCheck`, `npm run lint`, and `git diff --check`.
- [x] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` so the successful build invokes the deployment script.
- [x] Compare SHA-256 hashes for `main.js`, `manifest.json`, and `styles.css`.
- [x] Run one plugin reload and one Obsidian error-buffer check; use DOM inspection only if the installed CLI responds reliably.
