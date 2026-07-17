# Task Metadata, Markdown References, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix template settings overflow and Markdown project references, add user-defined task metadata end to end, then publish the verified plugin through the GitHub tag workflow.

**Architecture:** Keep presentation changes scoped with explicit CSS classes. Make Markdown decoration wait for the existing asynchronous task-index initialization and normalize Obsidian link targets before lookup. Extend task metadata settings with custom field definitions and persist values as reserved, valid Tasks-format tags so ordinary Tasks parsing remains compatible while plugin views can decode and render typed values.

**Tech Stack:** TypeScript, Obsidian API, Vitest with happy-dom, esbuild, CSS, GitHub Actions, npm, Git over SSH.

---

### Task 1: Constrain template metadata controls

**Files:**
- Modify: `src/settings/template-field-editor.ts`
- Modify: `styles.css`
- Test: `tests/settings/template-fields.test.ts`

- [ ] Add a failing structural test requiring `op-template-option-row` and `op-template-metadata-row` classes plus bounded text controls.
- [ ] Run `npm test -- tests/settings/template-fields.test.ts` and confirm the new assertions fail.
- [ ] Add the classes to priority, project metadata, and select-option settings. Limit their control inputs with `min-width: 0`, responsive widths, and wrapping only below the available width.
- [ ] Re-run the focused test and visually inspect the settings DOM after deployment.

### Task 2: Restore Markdown project references

**Files:**
- Modify: `src/integrations/markdown-reference-renderer.ts`
- Modify: `src/main.ts`
- Test: `tests/views/markdown-reference-renderer.test.ts`

- [ ] Add failing tests for path-qualified and encoded `data-href` values and for decoration waiting on a deferred index-ready promise.
- [ ] Run `npm test -- tests/views/markdown-reference-renderer.test.ts` and confirm lookup and readiness tests fail for the expected reasons.
- [ ] Add a normalized link-target candidate resolver and an async `decorateMarkdownReferencesWhenReady` wrapper.
- [ ] Create one `taskIndexReady` promise in `onload`, use it from the Markdown postprocessor, and retain error notification without launching a duplicate index scan.
- [ ] Re-run the focused test and later verify a rendered note through `obsidian dev:dom` or a controlled app-context check.

### Task 3: Add custom task metadata

**Files:**
- Modify: `src/settings/task-metadata-settings.ts`
- Modify: `src/settings/task-metadata-settings-editor.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/markdown/tasks-line-parser.ts`
- Modify: `src/markdown/embedded-subtask-parser.ts`
- Modify: `src/modals/create-subtask-modal.ts`
- Modify: `src/modals/edit-subtask-modal.ts`
- Create: `src/modals/task-custom-metadata-editor.ts`
- Modify: `src/views/task-metadata-presentation.ts`
- Modify: `src/views/task-view-model.ts`
- Modify: `src/views/dashboard-modules/todo-model.ts`
- Test: `tests/settings/task-metadata-settings.test.ts`
- Test: `tests/markdown/tasks-line-parser.test.ts`
- Test: `tests/markdown/embedded-subtask-parser.test.ts`
- Test: `tests/views/task-metadata-custom-fields.test.ts`

- [ ] Add failing normalization tests for unique custom keys, supported types, options, icon/color, visibility, and backward-compatible snapshots.
- [ ] Add failing parser round-trip tests for typed custom values encoded as reserved `#op-meta/<key>/<value>` task tags while preserving ordinary tags and title/completion edits.
- [ ] Add failing modal/presentation tests requiring custom controls and configured field rendering.
- [ ] Implement `TaskMetadataCustomFieldDefinition`, normalization, add/edit/delete UI, options for single/multi-select fields, and stable UUID-backed definitions.
- [ ] Extend `TasksLine` and `EmbeddedSubtask` with a `custom` record; encode values using browser-compatible UTF-8 base64url segments and decode defensively without rejecting malformed ordinary task lines.
- [ ] Render custom fields through their configured icon, color, and surface visibility. Add shared create/edit modal controls for text, number, boolean, date, and select values.
- [ ] Re-run focused tests after each implementation slice, then run the full suite.

### Task 4: Verify, deploy, and release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `manifest.json`
- Modify: `versions.json`
- Verify: `.github/workflows/release.yml`

- [ ] Run `npm test`, `npm run lint`, and `git diff --check`.
- [ ] Set `OBSIDIAN_VAULT_PATH=D:\\code\\obsidian\\test`, run `npm run build`, and confirm the deployment target contains `main.js`, `manifest.json`, and `styles.css`.
- [ ] Reload `obsidian-project`, check `obsidian dev:errors` and `obsidian dev:console level=error`, and inspect the relevant DOM.
- [ ] Bump the release to `1.1.0`, verify package/manifest/version-map consistency with `node scripts/check-release.mjs 1.1.0`, and rebuild/deploy the versioned artifacts.
- [ ] Commit the accumulated feature work, merge the feature branch into `master`, push `master` over the configured SSH remote, create annotated tag `1.1.0`, and push the tag.
- [ ] Monitor the GitHub Actions release workflow until it succeeds and verify that release assets include `main.js`, `manifest.json`, and `styles.css`.

### Task 5: Prioritized project assessment

**Files:**
- Inspect: `src/`, `tests/`, `.github/workflows/`, `package.json`

- [ ] Measure oversized modules, startup work, vault scan paths, network boundaries, test distribution, and persistence/migration coupling.
- [ ] Separate confirmed defects and architectural risks from feature opportunities.
- [ ] Report current issues and next development directions in P0/P1/P2 order, with concrete rationale and recommended acceptance criteria.
