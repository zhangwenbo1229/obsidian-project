# Dashboard Calendar Todo File Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve dashboard readability and add full calendar annotations, writable todos, manual progress, configurable note statistics, file ranking modes, and universal card duplication.

**Architecture:** Extend per-card normalized configuration for presentation and data choices, while placing cross-card file-open counters in global personal-dashboard settings. Keep lunar/solar-term, Markdown checkbox mutation, statistics filtering, file ranking, and card duplication as pure functions with regression tests before connecting them to Obsidian renderers and persistence.

**Tech Stack:** TypeScript, Obsidian API, DOM/SVG/CSS, `Intl.DateTimeFormat`, Vitest, ESLint, esbuild, npm deployment script.

---

### Task 1: Calendar metadata model

**Files:**
- Modify: `src/views/dashboard-modules/calendar-model.ts`
- Modify: `src/views/dashboard-modules/calendar-card.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Test: `tests/views/dashboard-calendar-model.test.ts`

- [ ] Add failing tests for Chinese lunar month/day, sexagenary year, fixed Gregorian festivals, traditional lunar festivals, Qingming and another solar term, today state, and weekend state.
- [ ] Run `npx vitest run tests/views/dashboard-calendar-model.test.ts` and confirm the new assertions fail because the metadata is absent.
- [ ] Parse Chinese-calendar `formatToParts` into stable month/day/year fields, map common lunar festivals, and calculate the 24 solar terms for 1900–2100 using the standard tropical-year minute offsets.
- [ ] Extend calendar cells with `lunarMonth`, `lunarDay`, `ganzhiYear`, `festivals`, `solarTerm`, and `isWeekend`; preserve the existing independent lunar/holiday toggles.
- [ ] Render the most relevant annotation with a complete tooltip, use theme accent for today, and add weekend styling without hiding annotations on narrow cards.
- [ ] Run the focused tests and confirm GREEN.

### Task 2: Writable Markdown todos

**Files:**
- Modify: `src/views/dashboard-modules/todo-model.ts`
- Modify: `src/views/dashboard-modules/todo-card.ts`
- Create: `tests/views/dashboard-todo-write.test.ts`
- Modify: `tests/views/dashboard-todo-model.test.ts`

- [ ] Add failing tests for changing only the selected source line from `[ ]` to `[x]`, preserving indentation/text/newlines, and refusing a stale/non-task line.
- [ ] Run the focused todo tests and confirm RED.
- [ ] Implement `setMarkdownTodoCompleted(markdown, line, completed)` as a pure validated transformation.
- [ ] Replace the decorative todo icon with a checkbox; on change use `vault.process(file, updater)`, disable the checkbox during persistence, and refresh the card after success while restoring it on error.
- [ ] Run focused tests and confirm GREEN.

### Task 3: Manual percentage and progress presentation

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-layout.ts`
- Modify: `src/views/personal-view.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `styles.css`
- Modify: `tests/views/dashboard-layout.test.ts`
- Modify: `tests/views/personal-layout.test.ts`

- [ ] Add failing tests for normalized manual current/target values, a zero target fallback, and a `number` versus `progress` presentation mode.
- [ ] Run focused tests and confirm RED.
- [ ] Add `percentageDataMode`, `percentageCurrent`, `percentageTarget`, and `percentageDisplay` to card layout normalization and persistence.
- [ ] Add settings controls visible only for percentage cards: task-derived/manual source, current value, target value, and percentage/progress display.
- [ ] Render a stable progress track with accessible `role="progressbar"`, percentage label, and clamped fill while preserving task-derived completion and overdue rates.
- [ ] Run focused tests and confirm GREEN.

### Task 4: Configurable note statistics

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/vault-data.ts`
- Modify: `src/views/dashboard-modules/note-stats-card.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `styles.css`
- Modify: `tests/views/dashboard-vault-data.test.ts`
- Modify: `tests/views/dashboard-module-config.test.ts`

- [ ] Add failing tests for extension filtering, frontmatter property presence/value matching, and configurable output fields.
- [ ] Run focused tests and confirm RED.
- [ ] Extend note-stat configuration with `extensions`, `metadataKey`, `metadataValue`, and ordered `displayFields` (`noteCount`, `characterCount`, `folderCount`, `totalSize`, `topFolders`).
- [ ] Filter paths before reads, use Obsidian metadata cache frontmatter for property filtering, compute total byte size, and render only configured tiles/sections in configured order.
- [ ] Add per-card settings for extensions, metadata property/value, and draggable/toggleable statistic fields using a small dedicated editor rather than project task-field controls.
- [ ] Run focused tests and confirm GREEN.

### Task 5: File card modes and persistent open counts

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/services/project-manager.ts`
- Modify: `src/main.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Rename/Modify: `src/views/dashboard-modules/recent-files-card.ts`
- Modify: `src/views/dashboard-modules/vault-data.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `src/settings/personal-dashboard-settings-editor.ts`
- Modify: `tests/views/dashboard-vault-data.test.ts`
- Modify: `tests/settings/personal-dashboard-settings.test.ts`

- [ ] Add failing tests for newest-created (`ctime`), newest-edited (`mtime`), and most-opened ordering with deterministic tie breakers; add normalization tests for bounded open counts.
- [ ] Run focused tests and confirm RED.
- [ ] Keep the stable persisted kind id `recent-files`, but relabel it to “文件”; add per-card mode `recent-created | recent-edited | frequently-opened`.
- [ ] Store bounded `fileOpenCounts` in personal-dashboard settings, add a manager method that increments and persists without notifying dashboard listeners, and register a plugin `file-open` event to count user opens.
- [ ] Render mode-specific timestamps/counts and add settings for mode, scope, exclusions, and limit. State clearly that common-file ranking starts accumulating after this version.
- [ ] Run focused tests and confirm GREEN.

### Task 6: Universal card duplication

**Files:**
- Modify: `src/views/dashboard-layout.ts`
- Modify: `src/views/personal-view.ts`
- Modify: `tests/views/dashboard-layout.test.ts`
- Modify: `tests/views/personal-layout.test.ts`

- [ ] Add a failing test that duplicates built-in and custom cards with a new id, deep-copied module configuration, a “副本” title, and insertion immediately after the source.
- [ ] Run focused tests and confirm RED.
- [ ] Implement `duplicateDashboardCard(layout, sourceId, newId)` without mutating shared arrays/objects.
- [ ] Add “复制卡片” to every card context menu; persist, rerender, and open the copied card settings.
- [ ] Run focused tests and confirm GREEN.

### Task 7: Chart and responsive visual polish

**Files:**
- Modify: `styles.css`
- Modify: `tests/views/dashboard-module-presentation.test.ts`

- [ ] Add a failing presentation test requiring chart axis/category/data/legend text to remain at least 11px on regular cards and at least 9px in narrow containers.
- [ ] Run the focused test and confirm RED against the current 8–9px rules.
- [ ] Increase chart labels, data labels, legend and compact-card type sizes; adjust chart padding and label offsets so larger text does not collide.
- [ ] Verify calendar, progress, note statistics and file rows remain readable at one-column and multi-column card sizes.
- [ ] Run the focused tests and confirm GREEN.

### Task 8: Documentation, regression, deployment, and Git sync

**Files:**
- Modify: `README.md`
- Modify: `docs/user-guide.md`

- [ ] Document writable todo behavior, manual progress, calendar annotations, metadata filters, file modes/open-count scope, and duplication.
- [ ] Run `npm run lint` and fix all errors/warnings.
- [ ] Run `npm test` and require every suite to pass.
- [ ] Run `npx tsc --noEmit --skipLibCheck` and `git diff --check`.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`; confirm deployment under `D:\code\obsidian\test\.obsidian\plugins\obsidian-project` and matching artifact hashes.
- [ ] Commit source/tests/docs without generated `main.js`, then push `feature/personal-dashboard-modules` over SSH.
