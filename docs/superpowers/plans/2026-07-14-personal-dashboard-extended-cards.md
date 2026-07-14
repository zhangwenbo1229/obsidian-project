# Personal dashboard extended cards implementation plan

**Goal:** Separate personal-dashboard settings, centralize weather credentials, correct calendar metadata, and add date, todo, countdown, and Vault activity heatmap cards while preserving existing card layout and module behavior.

**Architecture:** Keep persisted global personal-dashboard preferences in `PersonalDashboardSettings`; keep display/data choices that vary by card in each card's normalized `moduleConfig`. Implement date/lunar/holiday, todo parsing, countdown calculation, chart presentation, and heatmap aggregation as pure models first, then connect small renderers through the existing dashboard module registry. Preserve card resizing through the existing invisible pointer target while removing the visible resize glyph.

**Tech stack:** TypeScript, Obsidian API, DOM/SVG, Vitest, ESLint, esbuild, npm deployment script.

---

## Task 1: Dedicated settings page and global weather credentials

**Files:**
- Modify: `src/settings/settings-navigation.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/settings/personal-dashboard-settings-editor.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/weather-card.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Test: `tests/settings/settings-navigation.test.ts`
- Test: `tests/settings/personal-dashboard-settings.test.ts`
- Test: `tests/views/dashboard-module-config.test.ts`
- Test: `tests/views/dashboard-weather-service.test.ts`

1. Add failing tests for a `personal-dashboard` root page, normalized global weather credentials, legacy per-card credential migration/fallback, and removal of credential controls from per-card settings.
2. Add the settings page and render the existing enable/disable controls there.
3. Add QWeather host/key and OpenWeatherMap key to global personal-dashboard settings with safe HTTPS host normalization.
4. Read credentials from global settings when rendering weather cards and stop persisting new secrets in card configuration. Preserve compatibility with existing cards by migrating/falling back once without exposing secrets.
5. Run the focused tests.

## Task 2: Hide the visible resize handle without breaking resizing

**Files:**
- Modify: `src/views/personal-view.ts`
- Modify: `styles.css`
- Test: `tests/views/personal-layout.test.ts`

1. Add a failing regression test requiring the resize hit target and pointer handlers to remain while its SVG/icon is not rendered and the target is visually hidden.
2. Remove the icon rendering and retain an invisible bottom-right pointer area with an accessible label.
3. Run the focused test.

## Task 3: Calendar lunar and holiday controls

**Files:**
- Modify: `src/views/dashboard-modules/calendar-model.ts`
- Modify: `src/views/dashboard-modules/calendar-card.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Test: `tests/views/dashboard-calendar-model.test.ts`
- Test: `tests/views/dashboard-module-config.test.ts`

1. Add failing tests for a known lunar date and independent `showLunar`/`showHolidays` behavior.
2. Replace fragile formatted-string cleanup with stable Chinese-calendar `formatToParts` extraction and a safe fallback.
3. Add `showHolidays` normalization and settings UI; only populate/render holiday labels when enabled.
4. Run focused tests.

## Task 4: Date and countdown cards

**Files:**
- Create: `src/views/dashboard-modules/date-model.ts`
- Create: `src/views/dashboard-modules/date-card.ts`
- Create: `src/views/dashboard-modules/countdown-card.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/registry.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `styles.css`
- Create: `tests/views/dashboard-date-model.test.ts`
- Modify: `tests/views/dashboard-module-config.test.ts`
- Modify: `tests/views/dashboard-module-registry.test.ts`

1. Add failing tests for local-date formatting, lunar/holiday visibility, weekday visibility, and countdown boundaries/include-today behavior.
2. Implement pure date metadata and local calendar-day difference helpers.
3. Register date and countdown kinds with defaults and settings. Interpret the requested “unit” as weekday display unless corrected by the user.
4. Render a live clock with a self-cleaning timer and render countdown states for future, today, and elapsed dates.
5. Add responsive styles and run focused tests.

## Task 5: Todo card from Markdown folders

**Files:**
- Create: `src/views/dashboard-modules/todo-model.ts`
- Create: `src/views/dashboard-modules/todo-card.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/registry.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `styles.css`
- Create: `tests/views/dashboard-todo-model.test.ts`
- Modify: `tests/views/dashboard-module-config.test.ts`
- Modify: `tests/views/dashboard-module-registry.test.ts`

1. Add failing parser tests covering `-`, `*`, and `+` incomplete tasks, completed-task exclusion, line numbers, selected roots, exclusions, and limits.
2. Implement pure Markdown task extraction/path filtering.
3. Load matching Markdown files with `cachedRead`, render results and source paths, and open the source file on click.
4. Add per-card folder, exclusion, limit, and source-display settings.
5. Run focused tests.

## Task 6: Chart presentation controls

**Files:**
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/chart-model.ts`
- Modify: `src/views/dashboard-modules/chart-card.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `styles.css`
- Modify: `tests/views/dashboard-chart-model.test.ts`
- Modify: `tests/views/dashboard-module-config.test.ts`

1. Add failing tests for normalized axes, legend, data-label toggles and color values.
2. Extend line/bar SVG rendering to conditionally show axes, legend, and value labels using configured colors; keep pie behavior compatible and allow its legend/data labels.
3. Add card settings controls and validate color inputs with safe defaults.
4. Run focused tests.

## Task 7: Vault modification heatmap

**Files:**
- Create: `src/views/dashboard-modules/heatmap-model.ts`
- Create: `src/views/dashboard-modules/heatmap-card.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/registry.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `styles.css`
- Create: `tests/views/dashboard-heatmap-model.test.ts`
- Modify: `tests/views/dashboard-module-config.test.ts`
- Modify: `tests/views/dashboard-module-registry.test.ts`

1. Add failing tests for root/exclusion filtering, local-date aggregation from `stat.mtime`, complete week alignment, and intensity levels.
2. Aggregate one contribution per current Markdown file on its latest modified date; document in-card/settings copy that Obsidian does not expose historical edit counts.
3. Render a responsive GitHub-style seven-row grid with date/count tooltips and configurable accent color.
4. Run focused tests.

## Task 8: Regression verification, documentation, deployment, and Git sync

**Files:**
- Modify: `README.md`
- Modify: `docs/user-guide.md`
- Modify tests as needed for intentional catalog changes.

1. Update documentation for the settings page, weather privacy/network behavior, and new cards.
2. Run `npm test`.
3. Run `npm run lint`.
4. Run `npx tsc --noEmit --skipLibCheck`.
5. Run `git diff --check`.
6. Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`; confirm deployment artifacts under `D:\code\obsidian\test\.obsidian\plugins\obsidian-project`.
7. Review the final diff, commit on `feature/personal-dashboard-modules`, and push over SSH.
