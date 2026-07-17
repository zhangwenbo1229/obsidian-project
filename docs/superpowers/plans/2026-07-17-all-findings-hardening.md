# All Findings Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the identified data-loss, compatibility, performance, maintainability, and UI-regression risks without changing user-visible plugin behavior.

**Architecture:** Introduce narrow infrastructure services behind existing `ProjectManager` and dashboard interfaces, centralize native-sidebar DOM compatibility selectors, and preserve all public commands/settings/data semantics. Refactors move behavior into focused modules only after characterization tests pass.

**Tech Stack:** TypeScript, Obsidian API, Vitest/happy-dom, esbuild, CSS, Obsidian CLI.

---

### Task 1: Serialize configuration persistence and version snapshots

**Files:**
- Create: `src/settings/configuration-write-queue.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/services/project-manager.ts`
- Test: `tests/settings/configuration-write-queue.test.ts`
- Test: `tests/settings/configuration-store.test.ts`

- [ ] Write a failing concurrency test where two deferred saves are requested together and assert the store never has more than one active write and finishes with the second snapshot.
- [ ] Write a failing migration test that loads an unversioned snapshot and expects `configurationSchema: 2`, while a future schema is rejected with a readable error.
- [ ] Implement `ConfigurationWriteQueue.enqueue(snapshot)` as a promise tail that captures a cloned snapshot at call time and continues after a failed predecessor.
- [ ] Route normal persistence, import, and rollback writes through the queue while retaining existing verification and listener timing.
- [ ] Run the focused tests and existing configuration/deploy tests.

### Task 2: Share dashboard Vault file reads

**Files:**
- Create: `src/services/dashboard-vault-cache.ts`
- Modify: `src/services/project-manager.ts`
- Modify: `src/main.ts`
- Modify: `src/views/dashboard-modules/types.ts`
- Modify: `src/views/dashboard-modules/todo-card.ts`
- Modify: `src/views/dashboard-modules/note-stats-card.ts`
- Modify: `src/views/dashboard-modules/recent-files-card.ts`
- Modify: `src/views/dashboard-modules/directory-card.ts`
- Test: `tests/services/dashboard-vault-cache.test.ts`

- [ ] Write failing tests asserting concurrent reads of the same Markdown file share one `cachedRead`, cached content is invalidated on modify/delete/rename, and cache disposal removes listeners.
- [ ] Implement a Vault-scoped cache with file-list snapshots, in-flight read deduplication, and explicit `invalidate(path)`/`dispose()` lifecycle.
- [ ] Expose the cache through existing dashboard render context and replace direct repeated `getFiles`/`cachedRead` calls without changing filtering or sorting results.
- [ ] Run cache, dashboard data, todo, directory, recent-file, and note-stat tests.

### Task 3: Isolate internal task metadata tags

**Files:**
- Create: `src/markdown/task-custom-metadata-codec.ts`
- Modify: `src/markdown/tasks-line-parser.ts`
- Modify: `src/integrations/builtin-tag-editor.ts`
- Modify: `src/services/tag-service.ts`
- Test: `tests/markdown/task-custom-metadata-codec.test.ts`
- Test: `tests/views/field-tag-dom.test.ts`

- [ ] Write failing round-trip tests for codec version `v1`, malformed tokens, Unicode, and legacy `#op-meta/<key>/<value>` tokens.
- [ ] Write a failing DOM test asserting the `op-meta` internal namespace is hidden and cannot be renamed, regrouped, or dragged in the enhanced tag sidebar.
- [ ] Move encoding/decoding from the task-line parser into a versioned codec that reads legacy tokens and emits `#op-meta/v1/<key>/<value>`.
- [ ] Filter the internal namespace at tag presentation and tag mutation boundaries while preserving raw Markdown and Tasks compatibility.
- [ ] Run parser, tag service, tag DOM, task view, and todo tests.

### Task 4: Centralize native sidebar compatibility

**Files:**
- Create: `src/integrations/native-sidebar-dom.ts`
- Modify: `src/integrations/builtin-tag-editor.ts`
- Modify: `src/integrations/builtin-property-editor.ts`
- Test: `tests/views/native-sidebar-dom.test.ts`
- Test: `tests/views/property-management-view.test.ts`
- Test: `tests/views/field-tag-dom.test.ts`

- [ ] Write failing happy-dom fixtures for current and fallback Obsidian tag/property row shapes, semantic menu lookup, and unsupported markup returning no match without throwing.
- [ ] Implement selector arrays, row text/key extraction, closest-row helpers, and menu action-group discovery in one adapter.
- [ ] Update both integrations to consume the adapter and observe the workspace container for rows, using a separate short-lived document observer only when a native menu is expected.
- [ ] Preserve all cleanup registrations and verify existing grouping/context-menu behavior.

### Task 5: Split oversized modules without behavior changes

**Files:**
- Create: `src/settings/dashboard-module-settings/network-settings.ts`
- Create: `src/settings/dashboard-module-settings/content-settings.ts`
- Create: `src/settings/dashboard-module-settings/data-settings.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Create: `src/views/project-view-filter-panel.ts`
- Create: `src/views/project-view-card-renderers.ts`
- Modify: `src/views/project-view.ts`
- Create: `src/services/project-manager-configuration.ts`
- Create: `src/services/project-manager-people.ts`
- Modify: `src/services/project-manager.ts`
- Test: existing settings, project-view, project-manager, people, and template suites

- [ ] Record exported API and source line-count characterization tests before moving code.
- [ ] Move dashboard settings renderers into three responsibility modules while re-exporting the same function names from `module-settings.ts`.
- [ ] Move filter-panel construction and board/calendar/quadrant card rendering behind functions that receive explicit state/actions, leaving `ProjectView` lifecycle and state ownership unchanged.
- [ ] Move configuration/template and people persistence operations into collaborators constructed by `ProjectManager`; retain manager methods as stable delegating APIs.
- [ ] Require `project-manager.ts`, `project-view.ts`, and `module-settings.ts` to fall below their current line counts by at least 25%, with no change to public behavior tests.

### Task 6: Replace critical structural checks with runtime DOM coverage

**Files:**
- Create: `tests/integration/settings-dom.test.ts`
- Create: `tests/integration/project-view-dom.test.ts`
- Modify: `tests/e2e/manual-checklist.md`

- [ ] Add happy-dom tests that instantiate real settings controls for template option bounds, custom task metadata menu behavior, sidebar fallback markup, and dashboard empty/loading states.
- [ ] Add DOM interaction tests for filter add/remove, task-card click routing, inline editing, and horizontal list scrolling; retain source-string tests only for release artifact declarations.
- [ ] Run the complete test suite, lint, and `git diff --check`.
- [ ] Build with `OBSIDIAN_VAULT_PATH=D:\\code\\obsidian\\test` so the successful compile deploys automatically.
- [ ] Restart Obsidian and verify desktop/mobile DOM, runtime errors, console errors, Markdown project references, tag/property sidebars, and dashboard cards.
