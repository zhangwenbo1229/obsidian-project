# Dashboard, Filters, Markdown, And Task Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve personal and project task presentation, integrate tag rename into Obsidian's built-in Tags pane, add live Markdown preview, and expose task-type marker/title styling.

**Architecture:** Persist dashboard presentation preferences in the existing dashboard layout configuration, centralize project filter metadata, and centralize task-type title rendering so every view uses the same marker and color rules. Replace the custom tag view with one lifecycle-owned delegated DOM integration, and replace body/note textareas with a shared Markdown editor that owns edit, preview, and split modes.

**Tech Stack:** TypeScript, Obsidian API, DOM/CSS container queries, Vitest, esbuild.

---

### Task 1: Dashboard card presentation settings

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-layout.ts`
- Modify: `src/views/personal-view.ts`
- Create: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `styles.css`
- Test: `tests/views/dashboard-layout.test.ts`
- Test: `tests/views/personal-layout.test.ts`

- [x] Add failing tests that require `title` and `numberColor` to survive normalization and require a settings action, no numeric caption, hidden scrollbars, and container-responsive task cards.
- [x] Run `npm test -- tests/views/dashboard-layout.test.ts tests/views/personal-layout.test.ts` and verify failures are caused by missing dashboard customization.
- [x] Add optional dashboard title/color fields, an immutable `updateDashboardCardPresentation` helper, a settings modal opened from the card context menu, and use the persisted title/color while rendering.
- [x] Style cards with a stronger border/shadow hierarchy, hidden scrollbars, container queries, wrapped metadata, and no numeric scope caption.
- [x] Re-run the two dashboard tests and keep them green.

### Task 2: Project filter field correctness

**Files:**
- Modify: `src/views/project-filter-fields.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Test: `tests/views/project-filter-fields.test.ts`

- [x] Add failing tests for a single metadata source that maps each field to the correct picker label and control label/kind.
- [x] Run `npm test -- tests/views/project-filter-fields.test.ts` and verify the metadata assertions fail.
- [x] Export field definitions, consume them in the picker and control renderer, add `data-filter-field` to every wrapper, and raise only the open multi-select above adjacent controls.
- [x] Re-run the filter test and verify the field mapping is stable.

### Task 3: Responsive quadrant cards

**Files:**
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Test: `tests/views/card-layout.test.ts`

- [x] Add a failing CSS structure test for quadrant container sizing, auto-fit card columns, wrapping metadata, and responsive tags.
- [x] Run `npm test -- tests/views/card-layout.test.ts` and verify the responsive rules are missing.
- [x] Add container queries and responsive card grids while preserving the existing four-quadrant classification and click behavior.
- [x] Re-run the card layout test.

### Task 4: Built-in Tags pane editing

**Files:**
- Create: `src/integrations/builtin-tag-editor.ts`
- Modify: `src/main.ts`
- Modify: `src/commands/command-ids.ts`
- Modify: `src/commands/register-commands.ts`
- Delete: `src/views/tag-management-view.ts`
- Modify: `styles.css`
- Test: `tests/views/tag-management-view.test.ts`
- Test: `tests/commands/command-registration.test.ts`

- [x] Replace the custom-view test with failing tests for tolerant built-in tag-path extraction and delegated double-click registration; update the stable command expectation to the three non-tag commands.
- [x] Run the two targeted tests and verify they fail while the custom view remains registered.
- [x] Implement tag element detection for `.tag-pane-tag` and `.tag-pane-tag-text`, extract paths from `data-tag`, `aria-label`, or visible text, install an inline editor, and call `ProjectManager.renameTag` on Enter or blur.
- [x] Register the delegated listener with the plugin lifecycle, remove the custom view/ribbon/command, and remove obsolete custom tag-view styles and source.
- [x] Re-run the tag and command tests.

### Task 5: Shared live Markdown editor

**Files:**
- Create: `src/modals/markdown-editor.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `styles.css`
- Create: `tests/views/markdown-editor.test.ts`
- Modify: `tests/views/task-dialog-layout.test.ts`

- [x] Add failing tests for mode normalization and for create/edit body and notes using the shared editor.
- [x] Run `npm test -- tests/views/markdown-editor.test.ts tests/views/task-dialog-layout.test.ts` and verify failures are caused by the missing editor.
- [x] Implement Edit, Preview, and Split modes with `MarkdownRenderer.render`, a 200 ms debounce, renderer child cleanup, accessible mode buttons, and mobile-friendly single-pane behavior.
- [x] Replace create body/initial note and edit body/existing notes/new note inputs; keep ordinary link fields as textareas.
- [x] Re-run Markdown editor and dialog tests.

### Task 6: Task-type marker and title color

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/settings/template-editor.ts`
- Create: `src/views/task-type-presentation.ts`
- Modify: `src/views/personal-view.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Create: `tests/views/task-type-presentation.test.ts`
- Modify: `tests/settings/template-editor.test.ts`

- [x] Add failing tests for marker/color resolution, emoji versus Lucide marker rendering, template controls, and usage in personal/list/board/calendar/quadrant titles.
- [x] Run the targeted presentation tests and verify the helper and fields are missing.
- [x] Add optional `marker` and `titleColor` fields with legacy `icon` compatibility, expose inputs in the one-type template editor, and render task titles through one helper in all personal and project modes.
- [x] Re-run presentation and template tests.

### Task 7: Regression verification and deployment

**Files:**
- Verify: all changed files
- Deploy: `D:/code/obsidian/test/.obsidian/plugins/obsidian-project/`

- [x] Run `npm test`.
- [x] Run `npx tsc -noEmit -skipLibCheck` and `npm run lint`.
- [x] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`; successful build must deploy `main.js`, `manifest.json`, and `styles.css`.
- [x] Compare source and deployed artifact hashes.
- [x] Attempt one Obsidian plugin reload/error check only; if the installed CLI cannot reliably confirm runtime state, report that limitation without repeated process manipulation.
