# Markdown cards, project filters, and tag styles implementation plan

## Goal

Complete the requested personal/project card rendering, project filtering, dashboard layout, marker catalog, and built-in tag style features without regressing existing saved configurations.

## Root causes

- Links and subtasks are passed through a plain-text field helper, so Markdown is never rendered.
- Project cards are interactive `button` elements, which cannot safely contain Markdown links and checkboxes.
- The project view initializes from the first project instead of the existing all-project sentinel.
- The filter picker is rendered as a full-width sibling of the toolbar rather than an anchored popup owned by the add-filter trigger.
- No filter model currently represents tasks containing incomplete Markdown subtasks.
- Dashboard task-list direction is absent from the persisted card layout model.
- The marker picker uses a small hard-coded catalog.
- Tag presentation has no persisted style model, and the built-in Tags pane integration only handles rename/reparent operations.

## Test-first sequence

1. Add failing tests for Markdown field rendering, interactive card semantics, project card marker/priority placement, all-project default, and calendar sizing.
2. Add failing tests for the anchored scrollable filter picker and incomplete-subtask filtering, persistence, and active-count behavior.
3. Add failing tests for per-card task-list direction normalization, persistence, modal controls, and CSS layout.
4. Add failing tests for marker catalog breadth and representative Lucide/emoji entries.
5. Add failing tests for tag style snapshot persistence, rename/reparent migration, native context-menu integration, and shared tag rendering.

## Implementation sequence

1. Render Markdown fields through `MarkdownRenderer`, pass the owning component/source path, and replace nested-interactive task card buttons with accessible div-based controls.
2. Extend the shared card renderer with marker-before-key and corner-priority presentation used by board, calendar, and quadrant modes.
3. Default project scope to all projects, anchor the filter picker under its trigger, add incomplete-subtask filtering, and increase calendar card height.
4. Persist and render horizontal/vertical personal task-list layout.
5. Expand the marker catalog, add tag style persistence and editor UI, apply styles to the built-in Tags pane, and share configured tag rendering across personal/project modes.

## Verification

- Run targeted tests after each batch.
- Run `npm test`, `npx tsc --noEmit --skipLibCheck`, `npm run lint`, and `git diff --check`.
- Run the production build with `OBSIDIAN_VAULT_PATH=D:\code\obsidian\test`; the build script deploys artifacts automatically.
- Reload the plugin and inspect Obsidian developer errors/console.
