# Dashboard, Property Groups, and People Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct native property grouping and people-file behavior, refine existing dashboard cards, and add forward/count-up timing plus calendar progress cards.

**Architecture:** Keep native sidebar DOM manipulation isolated in `builtin-property-editor.ts`, with a pure grouping function and owned group containers. Store person-name presentation explicitly beside person metadata definitions and resolve Markdown mentions from that setting. Extend the dashboard through the existing module catalog/config/registry pipeline, keeping date-progress calculations in pure model files and rendering responsive through container-aware CSS.

**Tech Stack:** TypeScript, Obsidian API, Vitest with happy-dom, SVG/CSS container queries, npm/esbuild.

---

### Task 1: Native property group containers

**Files:**
- Modify: `src/integrations/builtin-property-editor.ts`
- Modify: `styles.css`
- Test: `tests/views/property-management-view.test.ts`

- [ ] **Step 1: Write the failing DOM test**

Add a test that renders two configured groups and asserts each matching `.tree-item` is physically nested inside the corresponding `.op-property-group-members`, while an unknown assignment is nested under the implicit ungrouped section.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/views/property-management-view.test.ts`

Expected: FAIL because the current integration only appends headings and leaves rows in one flat container.

- [ ] **Step 3: Add an owned group rendering helper**

Create a pure DOM helper that builds `.op-property-group-section`, a heading, and `.op-property-group-members`, then moves the complete native row anchor into the members container. Before rerendering, unwrap owned sections so Obsidian rows are restored without duplication.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/views/property-management-view.test.ts`

Expected: PASS.

### Task 2: Person name presentation and durable person files

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/services/person-metadata.ts`
- Modify: `src/settings/person-metadata-settings-editor.ts`
- Modify: `src/services/project-manager.ts`
- Modify: `src/integrations/markdown-reference-renderer.ts`
- Modify: `src/main.ts`
- Test: `tests/services/people-source.test.ts`
- Test: `tests/views/markdown-reference-renderer.test.ts`
- Test: `tests/views/person-metadata-presentation.test.ts`

- [ ] **Step 1: Write failing tests for explicit name presentation**

Assert normalized people configuration includes a `personNamePresentation` object with configurable icon/color/title; assert rendered `@Alice` consumes the source marker but displays only the icon and `Alice`.

- [ ] **Step 2: Write a failing manager regression test**

Exercise `savePerson` with metadata-source mode enabled and assert the Markdown file is created, the source cache is refreshed, and the in-memory person keeps the persisted `sourcePath` and `person-id`.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- tests/views/markdown-reference-renderer.test.ts tests/views/person-metadata-presentation.test.ts tests/services/people-source.test.ts`

Expected: FAIL for the missing explicit presentation and missing post-write source reconciliation.

- [ ] **Step 4: Implement configuration and rendering**

Add explicit name icon/color/title controls above metadata field definitions. Resolve Markdown references from those controls, remove the visible `@`, preserve the internal link target, and refresh sourced people after a successful write without dropping the newly created record.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same focused command and expect PASS.

### Task 3: Existing dashboard card refinements

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-layout.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `src/views/dashboard-modules/calendar-card.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `src/views/dashboard-modules/chart-card.ts`
- Modify: `src/views/personal-view.ts`
- Modify: `styles.css`
- Test: `tests/views/dashboard-layout.test.ts`
- Test: `tests/views/dashboard-module-config.test.ts`
- Test: `tests/views/dashboard-module-presentation.test.ts`

- [ ] **Step 1: Write failing refinement tests**

Cover the expanded font range, calendar check-in icon normalization, iframe chrome-free class, a shared semicircle DOM/CSS contract for percentage and check-in cards, and chart SVG sizing based on the live card bounds.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/views/dashboard-layout.test.ts tests/views/dashboard-module-config.test.ts tests/views/dashboard-module-presentation.test.ts`

Expected: FAIL for current 10-28px clamp, missing icon, fixed 400x220 chart model, and different semicircle markup.

- [ ] **Step 3: Implement the refinements**

Increase the persisted/settings font range, add a calendar check-in icon picker and icon rendering, give iframe cards transparent chrome with the frame filling the card, reuse one semicircle gauge structure, and use ResizeObserver-backed chart dimensions while retaining a stable SVG viewBox fallback.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same focused command and expect PASS.

### Task 4: Timer and period-progress modules

**Files:**
- Create: `src/views/dashboard-modules/time-progress-model.ts`
- Create: `src/views/dashboard-modules/time-progress-card.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-modules/date-model.ts`
- Modify: `src/views/dashboard-modules/date-card.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `src/views/dashboard-modules/registry.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/views/personal-view.ts`
- Modify: `styles.css`
- Create: `tests/views/dashboard-time-progress-model.test.ts`
- Modify: `tests/views/dashboard-date-model.test.ts`
- Modify: `tests/views/dashboard-module-config.test.ts`
- Modify: `tests/views/dashboard-module-registry.test.ts`

- [ ] **Step 1: Write failing pure model tests**

Assert timer mode returns elapsed natural days from a past date and countdown mode retains remaining-day semantics. Assert weekly, monthly, and yearly progress values use local calendar boundaries and remain within 0-1.

- [ ] **Step 2: Run model tests and verify RED**

Run: `npm test -- tests/views/dashboard-date-model.test.ts tests/views/dashboard-time-progress-model.test.ts`

Expected: FAIL because count-up mode and period progress do not exist.

- [ ] **Step 3: Implement model, config, and UI**

Rename the visible countdown module to `计时`, retain the stable internal `countdown` kind for migration, add a countdown/count-up mode selector, and render signed elapsed/remaining days. Add a new `progress` module with independent week/month/year visibility, fill color and track color controls; render compact horizontal bars with percentages.

- [ ] **Step 4: Rename the task-list label without migrating data**

Change visible card labels from `任务列表` to `项目`; keep the internal `task-list` kind and existing saved layouts intact.

- [ ] **Step 5: Run module tests and verify GREEN**

Run: `npm test -- tests/views/dashboard-date-model.test.ts tests/views/dashboard-time-progress-model.test.ts tests/views/dashboard-module-config.test.ts tests/views/dashboard-module-registry.test.ts`

Expected: PASS.

### Task 5: Full regression, build, deployment, and Obsidian verification

**Files:**
- Modify when necessary: affected implementation/tests only

- [ ] **Step 1: Run quality gates**

Run: `npm run lint`, `npm test`, and `npm run build:ci`.

Expected: all commands exit 0 with no TypeScript, ESLint, or test failures.

- [ ] **Step 2: Deploy the successful production build**

Run: `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`

Expected: deployment to `D:\code\obsidian\test\.obsidian\plugins\obsidian-project`.

- [ ] **Step 3: Restart and inspect Obsidian**

Run: `obsidian vault=test restart`, then inspect `dev:errors`, `dev:console level=error`, property group DOM, person references, and responsive dashboard cards.

Expected: no plugin errors; property rows are nested under their configured groups; iframe, timer, progress, chart, percentage, calendar and people references render correctly.

