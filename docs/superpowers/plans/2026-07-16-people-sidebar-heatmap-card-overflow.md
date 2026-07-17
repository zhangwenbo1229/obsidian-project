# People Metadata, Sidebar Groups, Heatmap, and Card Overflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed person metadata and person editing commands, make native sidebar groups complete, strengthen heatmap intensity, and prevent task metadata clipping in project cards.

**Architecture:** Keep `Person` as an identity record and store field values in a metadata map governed by global `PersonMetadataFieldDefinition` records. Reuse one modal for create/edit, expose person fields as clickable card controls, and keep Markdown metadata import driven by the configured field keys. Sidebar grouping remains an integration layer over Obsidian DOM, with pure row/group helpers covered by DOM tests.

**Tech Stack:** TypeScript, Obsidian API, esbuild, Vitest/happy-dom, CSS.

---

### Task 1: Typed person metadata model and migration

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/validation.ts`
- Create: `src/services/person-metadata.ts`
- Modify: `src/services/people-source.ts`
- Modify: `src/settings/configuration-store.ts`
- Test: `tests/services/people-source.test.ts`
- Test: `tests/settings/configuration-store.test.ts`

- [ ] **Step 1: Write failing normalization and source-import tests**

Assert that definitions for text, multiline text, number, boolean, date, datetime, single-select and multi-select normalize safely; legacy person `title/icon/color` values migrate into metadata fields; Markdown frontmatter is converted according to field type.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/services/people-source.test.ts tests/settings/configuration-store.test.ts`

Expected: FAIL because person metadata definitions and typed values do not exist.

- [ ] **Step 3: Implement the model**

Add `PersonMetadataFieldDefinition`, `PersonMetadataFieldType`, `Person.metadata`, and `GlobalConfig.personMetadataFields`. Normalize field keys, options, colors, icons, and typed values without changing the configuration schema number.

- [ ] **Step 4: Verify GREEN**

Run the focused tests again and expect all tests to pass.

### Task 2: Person modal, settings editor, command, and card interaction

**Files:**
- Create: `src/modals/person-modal.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/services/project-manager.ts`
- Modify: `src/commands/command-ids.ts`
- Modify: `src/commands/register-commands.ts`
- Modify: `src/views/task-card-fields.ts`
- Modify: `src/views/project-view.ts`
- Test: `tests/commands/command-registration.test.ts`
- Create: `tests/views/person-metadata-presentation.test.ts`

- [ ] **Step 1: Write failing command and presentation tests**

Assert a stable `create-person` command, typed modal controls, metadata field presentation controls, and clickable reporter/assignee fields that stop card activation.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/commands/command-registration.test.ts tests/views/person-metadata-presentation.test.ts`

Expected: FAIL because the command, modal, and click binding are missing.

- [ ] **Step 3: Implement create/edit behavior**

Use one modal with name, active state and definition-driven metadata controls. Add manager save methods, replace person-level title/icon/color settings with metadata-definition title/icon/color controls, and open the edit modal from reporter/assignee card fields.

- [ ] **Step 4: Verify GREEN**

Run the focused tests and expect all tests to pass.

### Task 3: Demo people and typed metadata

**Files:**
- Modify: `scripts/seed-demo.mjs`
- Modify: `tests/scripts/seed-demo.test.ts`

- [ ] **Step 1: Write a failing seed assertion**

Require at least three people, multiple metadata field types, and representative metadata values in generated `data.json`.

- [ ] **Step 2: Run the seed test and verify RED**

Run: `npx vitest run tests/scripts/seed-demo.test.ts`

Expected: FAIL because the demo snapshot has only the legacy/default person model.

- [ ] **Step 3: Add deterministic demo records**

Add product, engineering, and design people with role, department, capacity, start date, remote status and skills metadata.

- [ ] **Step 4: Verify GREEN**

Run the seed test and expect it to pass.

### Task 4: Native property and tag group completeness

**Files:**
- Modify: `src/services/tag-group-service.ts`
- Modify: `src/integrations/builtin-tag-editor.ts`
- Modify: `src/integrations/builtin-property-editor.ts`
- Modify: `src/settings/native-sidebar-settings.ts`
- Modify: `src/main.ts`
- Modify: `styles.css`
- Test: `tests/services/tag-group-service.test.ts`
- Test: `tests/views/property-management-view.test.ts`
- Test: `tests/views/markdown-card-tag-presentation.test.ts`

- [ ] **Step 1: Write failing default-group and menu tests**

Assert that empty custom-group configuration still yields an ungrouped section, native property virtual-tree rows use their `.tree-item` wrapper as the heading anchor, both integrations default to enabled, and group menus expose create/edit/delete.

- [ ] **Step 2: Run focused tests and verify RED**

Run the three focused test files and expect failures for missing default headings and actions.

- [ ] **Step 3: Implement group behavior**

Always group visible root rows, render an immutable ungrouped heading, add create/edit/delete menu items with edit/delete disabled for the implicit group, and remove assignments when custom groups are deleted.

- [ ] **Step 4: Verify GREEN**

Run the focused tests and expect all tests to pass.

### Task 5: Heatmap contrast and project-card overflow

**Files:**
- Modify: `styles.css`
- Modify: `src/views/task-card-fields.ts`
- Test: `tests/views/dashboard-module-presentation.test.ts`
- Test: `tests/views/project-view-regressions.test.ts`

- [ ] **Step 1: Write failing CSS regression tests**

Require explicit level 1-4 heatmap colors, visible overflow for embedded tasks and metadata, content-driven board/quadrant/calendar card heights, and calendar lanes that grow with wrapped metadata.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/views/dashboard-module-presentation.test.ts tests/views/project-view-regressions.test.ts`

Expected: FAIL against the current generic heatmap mix and hidden card overflow.

- [ ] **Step 3: Implement restrained visual fixes**

Use four theme-aware intensity levels with stronger contrast. Remove fixed clipping from project-card content, keep horizontal bounds with `min-width: 0`, and let each calendar lane size to its own content.

- [ ] **Step 4: Verify GREEN**

Run the focused tests and expect all tests to pass.

### Task 6: Full verification and deployment

**Files:**
- Modify only files required by failures.

- [ ] **Step 1: Run static and full automated checks**

Run: `npm run lint; npm test; npx tsc -noEmit -skipLibCheck; git diff --check`

Expected: zero errors and all tests pass.

- [ ] **Step 2: Build and deploy**

Run: `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`

Expected: build succeeds and deploy copies `main.js`, `manifest.json`, and `styles.css`.

- [ ] **Step 3: Reload and inspect Obsidian**

Run: `obsidian vault=test plugin:reload id=obsidian-project`, then `obsidian vault=test dev:errors` and `obsidian vault=test dev:console level=error`.

Expected: no plugin errors.

- [ ] **Step 4: Verify visible behavior**

Open the personal dashboard, project view and native tag/property views. Check menu actions, heatmap levels, card expansion and person modal interaction; use DOM/screenshot commands when supported by the installed Obsidian CLI.
