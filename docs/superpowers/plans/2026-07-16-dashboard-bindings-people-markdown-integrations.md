# Dashboard bindings, people and Markdown integrations implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend project-view rules, dashboard progress/check-in bindings, inline task editing, people sources, native sidebar grouping, and rich project/person references while preserving existing configuration.

**Architecture:** Keep normalization and pure models separate from Obsidian DOM integrations. Dashboard check-in data becomes card-scoped with a legacy migration path; project/person references are rendered by a Markdown post-processor; native tag/property enhancements remain opt-in MutationObserver integrations. Existing IDs and persisted project/task structures remain stable.

**Tech Stack:** TypeScript, Obsidian API, esbuild, Vitest, CSS, npm.

---

### Task 1: Project view rule normalization

**Files:**
- Modify: `src/views/task-display-settings.ts`
- Modify: `src/settings/view-display-editor.ts`
- Test: `tests/views/view-display-settings.test.ts`

- [ ] Add a failing test proving workflow statuses absent from persisted `groupStatusIds` are assigned to their current category.
- [ ] Run `npx vitest run tests/views/view-display-settings.test.ts` and verify the new assertion fails.
- [ ] Normalize mappings against live project workflows and replace the three priority toggles with one multi-select control.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Inline task editing and deletion

**Files:**
- Modify: `src/views/task-view.ts`
- Modify: `src/views/dashboard-modules/todo-card.ts`
- Modify: `styles.css`
- Test: `tests/views/task-view-presentation.test.ts`
- Test: `tests/views/dashboard-module-presentation.test.ts`

- [ ] Add failing presentation contracts for replacing the title button in place, replacing todo text in place, and a context-menu delete action.
- [ ] Run focused tests and verify they fail for the missing behavior.
- [ ] Insert editors before the hidden title node, keep the same grid cell, and call `ProjectManager.deleteEmbeddedSubtask()` from a confirmed right-click menu action.
- [ ] Re-run focused tests and verify they pass.

### Task 3: Card-scoped check-in data and progress styles

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/check-in-model.ts`
- Modify: `src/views/dashboard-modules/check-in-card.ts`
- Modify: `src/views/dashboard-modules/calendar-card.ts`
- Modify: `src/views/dashboard-modules/heatmap-card.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `src/views/personal-view.ts`
- Modify: `styles.css`
- Test: `tests/views/dashboard-check-in-model.test.ts`
- Test: `tests/views/dashboard-module-config.test.ts`
- Test: `tests/settings/personal-dashboard-settings.test.ts`

- [ ] Add failing tests for legacy-history migration, per-card histories, source-card normalization, linear/semicircle display modes and heatmap levels.
- [ ] Run the focused tests and verify failures.
- [ ] Store histories under check-in card IDs, migrate legacy history into the first check-in card, add source selectors to calendar/heatmap settings, and add configurable calendar check-in color.
- [ ] Render heatmap opacity from level 0–4 and add a reusable semicircle progress presentation for check-in and percentage cards.
- [ ] Re-run focused tests and verify they pass.

### Task 4: People directory sources and presentation

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/services/project-manager.ts`
- Create: `src/services/people-source.ts`
- Test: `tests/services/people-source.test.ts`
- Test: `tests/domain/validation.test.ts`

- [ ] Add failing tests for folder/frontmatter person collection, metadata-key mapping, deduplication and style normalization.
- [ ] Run focused tests and verify failures.
- [ ] Add optional person icon/color/title/sourcePath fields and configurable folder/name-property mapping; read only vault Markdown metadata and merge sourced people by stable file path.
- [ ] Add settings controls for manual style editing and source refresh.
- [ ] Re-run focused tests and verify they pass.

### Task 5: Native tag/property opt-in integrations

**Files:**
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/main.ts`
- Modify: `src/integrations/builtin-tag-editor.ts`
- Create: `src/integrations/builtin-property-editor.ts`
- Create: `src/settings/property-presentation.ts`
- Create: `src/modals/property-style-modal.ts`
- Create: `src/modals/property-group-modal.ts`
- Modify: `styles.css`
- Test: `tests/views/tag-management-view.test.ts`
- Create: `tests/views/property-management-view.test.ts`

- [ ] Add failing source/normalization tests for independent tag and property integration switches and property group/style configuration.
- [ ] Run focused tests and verify failures.
- [ ] Guard tag integration behavior behind its switch; add property row discovery, style application, group headings and context menus with registered cleanup.
- [ ] Re-run focused tests and verify they pass.

### Task 6: Rich project and person references

**Files:**
- Modify: `src/main.ts`
- Create: `src/integrations/markdown-reference-renderer.ts`
- Modify: `styles.css`
- Create: `tests/views/markdown-reference-renderer.test.ts`

- [ ] Add failing DOM tests for `[[PROJ-123]]` project links and `@name` person references, including unknown-reference fallback.
- [ ] Run the focused test and verify failure.
- [ ] Register a Markdown post-processor that decorates resolved project links and text-node person mentions with icon, color and title while preserving link navigation and code nodes.
- [ ] Re-run the focused test and verify it passes.

### Task 7: Full verification and deployment

**Files:**
- Verify all changed source and tests.

- [ ] Run `npm test` and require all test files to pass.
- [ ] Run `npm run lint` and `git diff --check`.
- [ ] Set `OBSIDIAN_VAULT_PATH=D:\code\obsidian\test` and run `npm run build`; verify the deploy script copies `main.js`, `manifest.json`, and `styles.css`.
- [ ] Run `obsidian vault=test restart`, open affected views, then run `obsidian vault=test dev:errors` and `obsidian vault=test dev:console level=error`.
