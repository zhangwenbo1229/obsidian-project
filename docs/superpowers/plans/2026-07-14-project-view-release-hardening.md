# Project View and Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dashboard and project-view regressions, expose complete card display rules, rename the personal workspace, and ship the merged code through an automated GitHub release.

**Architecture:** Keep chart and todo changes inside their dashboard modules, extract list scrolling into a dedicated viewport/rail structure, and extend the existing four-mode display settings rather than replacing its persisted schema. Release automation remains tag-driven, validates version equality, runs the full quality suite, and publishes the three Obsidian artifacts.

**Tech Stack:** TypeScript, Obsidian API, CSS Grid/SVG, Vitest, ESLint, esbuild, GitHub Actions.

---

### Task 1: Chart and todo interactions

**Files:**
- Modify: `src/views/dashboard-modules/chart-card.ts`
- Modify: `src/views/dashboard-modules/todo-card.ts`
- Modify: `styles.css`
- Test: `tests/views/dashboard-module-presentation.test.ts`
- Test: `tests/views/dashboard-todo-model.test.ts`

- [ ] Add failing source/CSS tests requiring a flex-filling chart canvas and separate todo edit/open targets.
- [ ] Run the focused tests and confirm they fail for the current fixed chart sizing and delayed single-click handler.
- [ ] Make the chart body and SVG fill the card while preserving legend space.
- [ ] Make the task text double-click-only for editing and the source label a separate single-click link.
- [ ] Run focused tests and confirm they pass.

### Task 2: Project card display rules

**Files:**
- Modify: `src/settings/view-display-editor.ts`
- Modify: `src/views/task-display-settings.ts`
- Modify: `styles.css`
- Test: `tests/views/view-display-settings.test.ts`

- [ ] Add failing tests proving board, calendar, and quadrant modes have independently persisted task-card field rules.
- [ ] Add explicit card-mode panels, descriptions, restore-default commands, and per-mode dirty state while retaining the four existing arrays.
- [ ] Verify `ProjectView.displayFields()` consumes the saved rules for all modes.

### Task 3: Stable list horizontal scrollbar

**Files:**
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Test: `tests/views/card-layout.test.ts`

- [ ] Add a failing regression test for separate vertical viewport and sticky horizontal scroll rail.
- [ ] Render the list table inside a width-owning inner wrapper and mirror horizontal scroll with an always-visible bottom rail.
- [ ] Keep incremental row rendering bound to the vertical viewport and clean up synchronization listeners with the view component.
- [ ] Run focused layout tests.

### Task 4: Naming and release automation

**Files:**
- Modify: `src/views/personal-view.ts`
- Modify: `src/main.ts`
- Modify: `src/commands/register-commands.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/settings/personal-dashboard-settings-editor.ts`
- Modify: `README.md`
- Modify: `.github/workflows/release.yml`
- Modify: `package.json`
- Modify: `manifest.json`
- Modify: `versions.json`
- Test: `tests/release/check-release.test.ts`

- [ ] Add failing tests for the new “个人仪表盘” name and non-draft release workflow.
- [ ] Rename all user-facing personal-view strings while keeping stable command/view IDs.
- [ ] Upgrade the version consistently and make the tag workflow run tests, lint, type/build checks, provenance, and direct release publication.
- [ ] Document release behavior and privacy boundaries.

### Task 5: Verification, merge, and release

**Files:**
- No production source changes expected.

- [ ] Run `npm run lint`, `npm test`, `npx tsc --noEmit --skipLibCheck`, and `git diff --check`.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` and verify deployed hashes.
- [ ] Commit and push the feature branch.
- [ ] Fast-forward `master` to the verified feature commit and push `master` through SSH.
- [ ] Create and push the exact version tag to trigger GitHub Actions.
- [ ] Query GitHub APIs until the workflow and published Release are confirmed successful.
