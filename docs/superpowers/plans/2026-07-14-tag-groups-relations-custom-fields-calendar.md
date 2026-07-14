# Tag Groups, Relation Links, Custom Fields, and Calendar Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent tag groups and grouped tag selection, make relations navigable, migrate custom fields into independent configurable display fields, and stop premature calendar-card wrapping.

**Architecture:** Store tag groups and root-tag assignments in plugin configuration while leaving actual tag paths unchanged. Represent configurable custom fields as `custom:<key>` display IDs and expand the legacy aggregate field during normalization. Keep relation navigation and grouped tag selection in shared render helpers so personal and all project modes behave identically.

**Tech Stack:** TypeScript, Obsidian API, Vitest, esbuild, CSS.

---

### Task 1: Tag group model and persistence

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/services/project-manager.ts`
- Create: `src/services/tag-group-service.ts`
- Test: `tests/services/tag-group-service.test.ts`
- Test: `tests/settings/configuration-store.test.ts`

- [ ] Add failing tests for grouping tags by root assignment, stable group ordering, configuration defaults, rename propagation, and delete-to-ungroup behavior.
- [ ] Add `TagGroup`, `tagGroups`, and `tagGroupAssignments` to the normalized configuration model.
- [ ] Add manager methods to save/delete groups and assign a root tag to a group.
- [ ] Update tag rename handling so assignment keys move with renamed roots.

### Task 2: Built-in Tags pane grouped presentation

**Files:**
- Modify: `src/integrations/builtin-tag-editor.ts`
- Create: `src/modals/tag-group-modal.ts`
- Create: `src/modals/tag-group-assignment-modal.ts`
- Modify: `styles.css`
- Test: `tests/views/markdown-card-tag-presentation.test.ts`

- [ ] Add failing source/CSS tests for same-line icon/name layout, group headers, create-group context actions, assignment actions, and group edit/delete actions.
- [ ] Insert stable group headers into the top-level native tag tree and reorder only top-level wrappers so nested children remain intact.
- [ ] Add right-click actions to create, rename, delete, and assign groups.
- [ ] Keep DOM updates idempotent so the existing mutation observer does not loop.

### Task 3: Grouped task-dialog tag picker

**Files:**
- Create: `src/modals/grouped-tag-picker.ts`
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `styles.css`
- Test: `tests/views/task-dialog-layout.test.ts`

- [ ] Add failing tests proving both task dialogs use the grouped picker instead of comma-separated text.
- [ ] Render selected tags, grouped checkbox options, an ungrouped section, and a small new-tag input.
- [ ] Preserve task-type switching drafts and existing tag values.

### Task 4: Independent custom display fields

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/task-display-settings.ts`
- Modify: `src/settings/sortable-display-fields.ts`
- Modify: `src/settings/view-display-editor.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `src/views/dashboard-layout.ts`
- Modify: `src/views/task-card-fields.ts`
- Modify: `src/views/project-view.ts`
- Modify: `src/views/personal-view.ts`
- Test: `tests/views/view-display-settings.test.ts`
- Test: `tests/views/dashboard-layout.test.ts`

- [ ] Add failing tests for `custom:<key>` catalog entries, dynamic labels, legacy aggregate expansion, per-field card rendering, and draggable configuration.
- [ ] Introduce display-field catalog helpers that combine built-ins with project custom fields.
- [ ] Expand legacy `customFields` entries at normalization time while preserving their position.
- [ ] Render each custom field with its own configured name and formatted value.

### Task 5: Clickable task relations and aligned links

**Files:**
- Create: `src/views/task-relation-presentation.ts`
- Modify: `src/views/task-card-fields.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Test: `tests/views/markdown-card-tag-presentation.test.ts`

- [ ] Add failing tests for shared relation buttons in card and list modes and interactive-target event isolation.
- [ ] Resolve each relation by UID and open the target task path on click.
- [ ] Align link labels and Markdown content with a two-column field layout and remove nested paragraph offsets.

### Task 6: Calendar compact header and wrapping fix

**Files:**
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Test: `tests/views/project-view-regressions.test.ts`
- Test: `tests/views/card-layout.test.ts`

- [ ] Add failing tests for calendar `keyTitleInline`, an auto-sized compact field flow, and no 180px title flex basis inside calendar cards.
- [ ] Reuse the shared key/title heading line for calendar cards.
- [ ] Override calendar field flex sizing and Markdown width without changing board or personal cards.

### Task 7: Verification and deployment

**Files:**
- Verify: all modified files

- [ ] Run targeted tests after every RED/GREEN batch.
- [ ] Run `npm test`, `npx tsc --noEmit --skipLibCheck`, `npm run lint`, and `git diff --check`.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` to compile and deploy.
- [ ] Reload the plugin and inspect grouped tags, task-dialog tag selection, relation navigation, custom field configuration, and calendar computed styles using Obsidian CLI.
