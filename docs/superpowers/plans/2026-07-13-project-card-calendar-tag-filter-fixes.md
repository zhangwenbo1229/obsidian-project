# Project Card, Calendar, Tag, and Filter Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix project-card density, tag icon rendering, list scrolling, filter removal, custom date-time display, and add a weekly calendar mode.

**Architecture:** Keep shared task-card rendering in `task-card-fields.ts`, move custom-field formatting and calendar range calculations into small pure helpers, and make the built-in Tags integration read the current Obsidian tag DOM without rewriting native label nodes. Project view state owns the month/week calendar mode and progressive filter controls.

**Tech Stack:** TypeScript, Obsidian API, Vitest, esbuild, CSS.

---

### Task 1: Presentation helpers and regression tests

**Files:**
- Create: `src/views/custom-field-presentation.ts`
- Create: `src/views/calendar-range.ts`
- Modify: `tests/utils/dates.test.ts`
- Modify: `tests/views/selectors.test.ts`
- Create: `tests/views/project-view-regressions.test.ts`

- [ ] Add tests proving `datetime` custom values render as `YYYY-MM-DD HH:mm` without offsets, reversed calendar ranges still appear on their due date, and week ranges contain exactly Monday through Sunday.
- [ ] Run targeted tests and verify failures are caused by missing helpers/behavior.
- [ ] Implement the pure formatting and calendar-range helpers.
- [ ] Run targeted tests and verify they pass.

### Task 2: Repair tag style path detection and migration

**Files:**
- Modify: `src/integrations/builtin-tag-editor.ts`
- Modify: `src/services/project-manager.ts`
- Modify: `src/views/tag-presentation.ts`
- Modify: `tests/services/tag-service.test.ts`
- Modify: `tests/views/markdown-card-tag-presentation.test.ts`

- [ ] Add failing tests for extracting `parent/child` from the current Tags pane DOM contract and moving malformed persisted style keys such as `frontend1` back to `frontend`.
- [ ] Replace the obsolete label selector with a helper that reads `.tag-pane-tag-parent` plus the leaf `.tree-item-inner-text` and never includes the count badge.
- [ ] Insert style icons inside `.tree-item-inner` without changing Obsidian-owned label text.
- [ ] Persist one-time migration from stale `data-op-tag-path` values when the corrected path is known.

### Task 3: Project filter removal and compact picker

**Files:**
- Modify: `src/views/project-filter-fields.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Modify: `tests/views/project-filter-fields.test.ts`

- [ ] Add failing tests for a 248px picker, no combination-heading copy, and an icon-only remove control on every selected condition.
- [ ] Add `ProjectFilterFields.remove()` and a project-view helper that clears the removed condition's value.
- [ ] Render remove controls for multi-value, boolean, date, and custom conditions.
- [ ] Verify progressive filters and saved filters continue to work.

### Task 4: Card density, subtasks, and list scrolling

**Files:**
- Modify: `src/views/task-card-fields.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Modify: `tests/views/card-layout.test.ts`
- Modify: `tests/views/markdown-card-tag-presentation.test.ts`

- [ ] Add failing tests for board key/title header grouping, aligned task-list checkboxes, visible horizontal list scrolling, no card-field divider borders, and non-forced wrapping.
- [ ] Group board key/title into one header row while respecting configured field visibility.
- [ ] Remove unnecessary card dividers and allow compact fields to share a row.
- [ ] Normalize invalid calendar start/end ranges so tasks with subtasks remain visible.
- [ ] Constrain list ancestors with `min-width: 0` and keep an explicit horizontal scrollbar.

### Task 5: Weekly calendar mode

**Files:**
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Modify: `tests/views/project-view-regressions.test.ts`

- [ ] Add failing source/CSS tests for month/week controls and seven-day week rendering.
- [ ] Add a calendar mode state, mode switch, week-aware navigation, and week title.
- [ ] Reuse the shared calendar date-cell renderer for month and week modes.
- [ ] Verify month mode remains unchanged for normal date ranges.

### Task 6: Full verification and deployment

**Files:**
- Verify: all changed source and test files

- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit --skipLibCheck`, `npm run lint`, and `git diff --check`.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` so the successful build deploys automatically.
- [ ] Reload `obsidian-project`, inspect `dev:errors` and error-level console output, and use `obsidian eval`/screenshots to inspect tag, board, calendar, quadrant, and list DOM.
