# People, Metadata, and Dashboard Regression Plan

**Goal:** Fix the five reported settings/sidebar/dashboard regressions without removing persisted project or task data.

**Architecture:** Keep native sidebar styling in the property integration, route person deletion through `ProjectManager`, model metadata removal as a persisted disabled presentation that can be restored, and keep dashboard sizing inside the iframe module lifecycle.

**Tech stack:** TypeScript, Obsidian API, Vitest, CSS, npm/esbuild.

### Task 1: Property action styling and person deletion

- [x] Add regression tests for a non-warning property delete action and guarded person deletion.
- [x] Remove warning-only menu styling from the property group action.
- [x] Add `ProjectManager.deletePerson`, blocking the current user and referenced people, then trashing a managed source file and persisting configuration.
- [x] Add a delete button beside each non-current person in Settings -> People.

### Task 2: Project and task metadata controls

- [x] Add tests for remove/re-add semantics and metadata item dividers.
- [x] Render only enabled project built-in fields, with delete actions and an add-field selector for disabled fields.
- [x] Add persisted `enabled` state to task metadata presentations, with delete and add controls.
- [x] Ensure task metadata renderers ignore disabled definitions.

### Task 3: Dashboard regressions

- [x] Add a test requiring a supported heatmap icon in both the catalog and definition.
- [x] Replace the unsupported heatmap icon name with a stable Obsidian/Lucide icon.
- [x] Add `ResizeObserver` sizing to iframe cards and register cleanup with the module component.
- [x] Remove fixed iframe minimum sizing that can outgrow a resized card.

### Task 4: Verification and deployment

- [x] Run focused tests, ESLint, the full test suite, and `npm run build:ci`.
- [x] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` to deploy the successful build.
- [x] Restart the `test` vault and inspect runtime errors and plugin load state.
