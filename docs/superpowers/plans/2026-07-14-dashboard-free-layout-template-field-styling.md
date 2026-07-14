# Personal dashboard and task template enhancement plan

**Goal:** Add per-card typography and inline editing, richer percentage and note-stat data sources, configurable task-field presentation, an eight-column free-position dashboard, and lower startup I/O cost without changing existing task behavior.

## 1. Extend and normalize persisted models

- Add a bounded per-card font size, direct percentage value, and optional dashboard grid coordinates.
- Add independently filtered note-count metric definitions while retaining the legacy aggregate note-stat configuration.
- Add icon and font-color presentation properties to built-in and custom fields.
- Normalize legacy settings deterministically so existing vault configuration remains valid.
- Test all defaults, bounds, legacy migrations, and round trips before implementation.

## 2. Dashboard card configuration and rendering

- Add font-size controls to every card's settings and expose one card-local CSS variable used by every card body.
- Add the direct percentage mode and render a clamped numeric percentage.
- Remove the todo text background and add guarded Markdown-line text replacement.
- Add inline double-click editors for todo and text cards with Escape cancellation and explicit/blur save behavior.
- Add independently configurable note-count rows with add/remove controls and per-row filters.
- Test pure update/count helpers and source-level UI contracts.

## 3. Eight-column free layout

- Change the desktop dashboard to eight stable grid tracks and allow spans from one to eight tracks.
- Persist explicit row/column starts on drag, retain gaps, and resolve collisions deterministically without overlap.
- Preserve order-based auto placement for legacy cards until the user moves them.
- Update resize math and responsive fallbacks; verify small cards keep readable, non-overlapping content.

## 4. Task-template field presentation

- Add icon picker and font-color controls for every built-in field and every custom field.
- Replace select-option free text with structured add/edit/delete controls while preserving existing option IDs and values.
- Apply configured presentation in task forms and task-card custom-field rendering without altering stored task values.
- Add validation and normalization tests for invalid or legacy values.

## 5. Startup performance

- Split configuration application from task-index rebuilding so initialization loads configuration once.
- Scan task candidates once and parse them with a small bounded concurrency pool while preserving deterministic index order.
- Keep initialization awaited so views and commands observe the same ready state as before.
- Add tests for one configuration load, bounded parallelism, deterministic results, and error handling.

## 6. Verification and deployment

- Run focused tests after each implementation slice, then lint, all tests, TypeScript checking, and `git diff --check`.
- Run the production build with `OBSIDIAN_VAULT_PATH=D:\\code\\obsidian\\test` so successful artifacts are deployed automatically.
- Verify deployed `main.js`, `manifest.json`, and `styles.css` match build outputs, then commit and push the feature branch.
