# Saved Filters, Template Catalog, and Workflow Editor Implementation Plan

> **For agentic workers:** Implement inline in this session. Every behavior change starts with a failing Vitest test, and every successful production build must run the deployment script.

**Goal:** Provide reusable JIRA-style project filters, centrally managed task templates with graphical workflows, richer Markdown task dialogs, and a rebuilt configured demo project.

**Architecture:** Extend the plugin-data snapshot with normalized template and saved-filter catalogs while preserving existing project runtime fields for backward compatibility. A project selects one catalog template; applying or editing a template synchronizes its task types, custom fields, and workflow into the project so existing indexing, validation, migration, and views continue to work unchanged.

**Tech Stack:** TypeScript, Obsidian API, Vitest, CSS, npm, esbuild, Obsidian CLI.

---

### Task 1: Backward-compatible configuration catalogs

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/services/project-manager.ts`
- Test: `tests/settings/configuration-store.test.ts`
- Test: `tests/services/template-service.test.ts`

- [x] Add failing tests proving old snapshots receive empty catalogs and applying a template copies task types, custom fields, and workflow without sharing object references.
- [x] Add `TaskConfigurationTemplate`, `SavedProjectFilter`, `taskTemplates`, `savedProjectFilters`, and optional `templateId` types.
- [x] Normalize missing arrays during load and expose manager methods that save templates, delete unused templates, apply a template to a project, and persist filter presets.
- [x] Run the two targeted test files and confirm they pass.

The synchronization contract is:

```ts
project.templateId = template.id;
project.taskTypes = structuredClone(template.taskTypes);
project.customFields = structuredClone(template.customFields);
project.workflow = structuredClone(template.workflow);
```

### Task 2: Serializable reusable project filters

**Files:**
- Create: `src/views/saved-project-filters.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Test: `tests/views/saved-project-filters.test.ts`
- Modify: `tests/views/project-filter-fields.test.ts`

- [x] Add failing tests for converting `ProjectFilters` sets to JSON-safe arrays and restoring them without sharing mutable sets.
- [x] Implement `serializeProjectFilter`, `restoreProjectFilter`, and a preset-name validator.
- [x] Add a saved-filter selector, save action, update action, and delete menu to the project toolbar.
- [x] Restyle the filter bar as a compact JIRA-style query surface: search, filter chips, field menu, saved-view selector, and result count remain on stable rows.
- [x] Run targeted filter tests and confirm they pass.

### Task 3: Template catalog and project basic settings

**Files:**
- Create: `src/settings/template-editor.ts`
- Create: `src/settings/workflow-editor.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/modals/project-config-modal.ts`
- Modify: `styles.css`
- Test: `tests/settings/template-editor.test.ts`
- Modify: `tests/settings/settings-layout.test.ts`

- [x] Add failing structural tests requiring template create/edit controls, per-task-type body editors, template selection in projects, and workflow graph classes.
- [x] Build template list/detail navigation with create, rename, description, task-type add/edit/remove, custom-field add/edit/remove, and save.
- [x] Render workflow statuses as category-colored nodes and transitions as directional rows connecting source and target nodes; keep form controls accessible for precise editing.
- [x] Reduce project detail to name, active state, task directory, monthly grouping, template selection, project-code migration, and deletion.
- [x] Applying a selected template must call `manager.applyTemplateToProject(project, templateId)` before saving.
- [x] Run targeted settings tests and confirm they pass.

### Task 4: Markdown links and notes in create/edit dialogs

**Files:**
- Modify: `src/services/task-service.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `styles.css`
- Modify: `tests/services/task-service.test.ts`
- Modify: `tests/views/task-dialog-layout.test.ts`

- [x] Add failing tests proving new tasks retain ordinary Markdown links and an initial Markdown note.
- [x] Extend `NewTaskInput` with `links` and `note`, mapping links to `unknownLinks` and notes to a structured `TaskNote` authored by the current user.
- [x] Add large Markdown textareas for body, links, and notes in create; add editable links and a larger new-note editor in edit.
- [x] Keep structured parent/related task controls separate from ordinary Markdown links.
- [x] Run targeted task-service and dialog-layout tests and confirm they pass.

### Task 5: Rebuild configured demo data

**Files:**
- Modify: `scripts/seed-demo.mjs`
- Create: `tests/scripts/seed-demo.test.ts`

- [x] Add a failing structural test requiring template catalog setup, saved filter presets, Markdown links, notes, and deterministic demo cleanup.
- [x] Delete only tasks tagged `demo-data` in project `PLAY`, then recreate the configured template, project selection, people, saved filters, tasks, relations, links, and notes.
- [x] Keep all other projects and user-authored tasks untouched.
- [x] Run the seed script test and then execute `npm run seed:demo` against the test Vault.

### Task 6: Verification and deployment

**Files:** all modified sources and deployed artifacts.

- [x] Run `npm test`, `npx tsc -noEmit -skipLibCheck`, `npm run lint`, encoding scan, and `git diff --check`.
- [x] Run `npm run build` with `OBSIDIAN_VAULT_PATH=D:\\code\\obsidian\\test`; successful compilation must automatically deploy.
- [x] Reload `obsidian-project`, inspect saved filters, template editing, workflow graph, project template selection, and create/edit Markdown fields.
- [x] Run `obsidian dev:errors` and `obsidian dev:console level=error`, then compare source and deployed artifact hashes.
