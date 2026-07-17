# View Layout and Calendar Regression Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven development for every behavior change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicate workflow dates, correct checkbox/content alignment, refine the dedicated task view, remove project-card shadows, and restore visible cross-date calendar spans.

**Architecture:** Keep completion and termination timestamps as workflow-owned metadata while removing them from user-configurable form fields. Centralize card shadow/alignment overrides in scoped CSS, add a persisted-in-view collapsible task sidebar state, and introduce a pure calendar lane layout model that converts date ranges into week-row column spans for both month and week rendering.

**Tech Stack:** TypeScript, Obsidian API, Vitest, CSS Grid, npm, esbuild, Obsidian CLI.

---

### Task 1: Workflow-owned completion dates

**Files:**
- Modify: `src/settings/task-field-configuration.ts`
- Modify: `src/settings/template-field-editor.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `tests/settings/template-fields.test.ts`
- Modify: `tests/views/task-dialog-layout.test.ts`

- [ ] Add failing assertions that `completedAt` and `terminatedAt` are absent from configurable project fields and edit controls.
- [ ] Remove both fields from the form-field union/configuration list and edit modal validation payload while retaining metadata and workflow transitions.
- [ ] Run template and dialog tests plus typecheck.

### Task 2: Todo and task-row alignment

**Files:**
- Modify: `styles.css`
- Modify: `tests/views/dashboard-module-presentation.test.ts`
- Modify: `tests/views/task-view-presentation.test.ts`

- [ ] Add failing CSS contract tests for direct-child grid placement, left alignment, fixed checkbox size, and no button flex growth.
- [ ] Add scoped layout rules for todo rows, task-view rows, embedded tasks, and Markdown-rendered task lists.
- [ ] Verify computed layout in Obsidian at desktop and narrow widths.

### Task 3: Collapsible card-style task view

**Files:**
- Modify: `src/views/task-view.ts`
- Modify: `styles.css`
- Modify: `tests/views/task-view-presentation.test.ts`

- [ ] Add failing tests for an accessible sidebar toggle and collapsed shell class.
- [ ] Implement the toggle with Lucide icons and stable dimensions.
- [ ] Restyle project groups as bordered, shadowless cards and task rows as aligned card content.

### Task 4: Shadowless project cards in every mode

**Files:**
- Modify: `styles.css`
- Modify: `tests/views/card-layout.test.ts`
- Modify: `tests/views/project-view-regressions.test.ts`

- [ ] Add failing rules that board, calendar, quadrant, and task-card containers have no shadow and retain responsive content flow.
- [ ] Consolidate scoped shadow removal and normalize embedded-task/checklist alignment inside project cards.
- [ ] Inspect board, calendar, quadrants, and list modes in Obsidian.

### Task 5: Calendar cross-date lane rendering

**Files:**
- Create: `src/views/calendar-span-layout.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Create: `tests/views/calendar-span-layout.test.ts`
- Modify: `tests/views/project-view-regressions.test.ts`

- [ ] Add failing tests for single-day, same-week, cross-week, clipped-month, and week-view spans.
- [ ] Implement a pure range-to-week-segment layout with deterministic overlap lanes.
- [ ] Render calendar cards in an overlay grid spanning the correct day columns while preserving day cells and click behavior.
- [ ] Verify month and week modes with seeded scheduled/deadline and start/end ranges.

### Task 6: Regression verification and deployment

**Files:**
- Modify: `tests/e2e/manual-checklist.md`

- [ ] Run targeted tests, full `npm test`, typecheck, lint, and `git diff --check`.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` and confirm deployed artifacts.
- [ ] Cold-restart Obsidian, inspect errors/console, and verify computed DOM layout and calendar spans.
