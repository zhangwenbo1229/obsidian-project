# Personal Dashboard Card Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the personal calendar card and extend dashboard configuration with weather providers, directory exclusions, per-card backgrounds, card-type availability, and text/chart cards.

**Architecture:** Keep persisted card state normalized through `dashboard-layout.ts` and module-specific state normalized through `dashboard-modules/config.ts`. Add a persisted personal-dashboard settings object for card-type availability, keep weather providers behind one normalized service interface, and implement text/chart rendering without runtime dependencies or remote code.

**Tech Stack:** TypeScript, Obsidian API, esbuild, Vitest, SVG, CSS container queries, MarkdownRenderer, Open-Meteo, WeatherAPI.com, OpenWeatherMap.

---

### Task 1: Calendar month consistency and scrolling

**Files:**
- Modify: `src/views/dashboard-modules/calendar-card.ts`
- Modify: `src/views/dashboard-modules/calendar-model.ts`
- Modify: `styles.css`
- Test: `tests/views/dashboard-calendar-model.test.ts`
- Test: `tests/views/dashboard-module-presentation.test.ts`

- [ ] Add a failing regression test proving adjacent-month padding cells do not render a day number and the calendar module body uses `overflow: auto`.
- [ ] Run `npx vitest run tests/views/dashboard-calendar-model.test.ts tests/views/dashboard-module-presentation.test.ts` and confirm the regression fails.
- [ ] Keep padding cells for weekday alignment but render them as empty cells; move the active `YYYY 年 M 月` label into the heading subtitle and update it on every previous/next/today action.
- [ ] Remove the `.op-calendar-card { overflow: hidden; }` override and constrain the calendar grid with `min-width` so a narrow resized card scrolls horizontally and vertically.
- [ ] Re-run the two tests and confirm they pass.

### Task 2: Weather forecast days and provider abstraction

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/weather-service.ts`
- Modify: `src/views/dashboard-modules/weather-card.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Test: `tests/views/dashboard-module-config.test.ts`
- Test: `tests/views/dashboard-weather-service.test.ts`

- [ ] Add failing tests for `forecastDays` normalization to 1–7, provider selection, missing API-key errors, provider URL generation, and normalization into the existing `WeatherSnapshot` shape.
- [ ] Run the weather tests and confirm missing provider APIs fail.
- [ ] Add `WeatherProviderId = 'open-meteo' | 'weatherapi' | 'openweathermap'`, `forecastDays`, `provider`, and optional `apiKey` to the card configuration.
- [ ] Implement provider adapters that return the same current-condition and daily-forecast model; Open-Meteo remains the default and requires no key, while WeatherAPI.com and OpenWeatherMap require an explicit key.
- [ ] Add provider, API key, and forecast-day controls to the weather card settings; never request data while networking is disabled.
- [ ] Re-run weather and configuration tests.

### Task 3: Directory exclusions for local note cards

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Modify: `src/views/dashboard-modules/vault-data.ts`
- Modify: `src/views/dashboard-modules/note-stats-card.ts`
- Modify: `src/views/dashboard-modules/recent-files-card.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Test: `tests/views/dashboard-vault-data.test.ts`

- [ ] Add failing tests proving an excluded directory removes that directory and every descendant while similarly prefixed sibling directories remain included.
- [ ] Run `npx vitest run tests/views/dashboard-vault-data.test.ts` and confirm the tests fail.
- [ ] Add normalized `excludePaths: string[]` to note-statistics and recent-file configurations.
- [ ] Introduce `filterFilesByScope(files, rootPath, excludePaths)` and route aggregation and recent-file selection through it.
- [ ] Add one-directory-per-line exclusion controls to both card settings.
- [ ] Re-run the vault-data tests.

### Task 4: Background color for every dashboard card

**Files:**
- Modify: `src/views/dashboard-layout.ts`
- Modify: `src/views/personal-view.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `styles.css`
- Test: `tests/views/dashboard-layout.test.ts`
- Test: `tests/views/personal-layout.test.ts`

- [ ] Add failing tests proving task-list and module cards preserve `backgroundColor` and the personal view applies a shared background CSS variable.
- [ ] Run the dashboard tests and confirm non-stat cards lose their background.
- [ ] Normalize a background color for every card kind and render the background picker before kind-specific settings.
- [ ] Apply `--op-dashboard-card-background` on every card and blend it with Obsidian theme surfaces so text contrast remains readable in light and dark themes.
- [ ] Re-run dashboard and personal-layout tests.

### Task 5: Configurable card-type availability

**Files:**
- Create: `src/views/personal-dashboard-settings.ts`
- Create: `src/settings/personal-dashboard-settings-editor.ts`
- Modify: `src/settings/configuration-store.ts`
- Modify: `src/services/project-manager.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/views/personal-view.ts`
- Test: `tests/settings/personal-dashboard-settings.test.ts`
- Test: `tests/views/dashboard-module-registry.test.ts`

- [ ] Add failing tests for migration defaults, invalid-kind removal, persisted saves, and workspace-menu filtering.
- [ ] Run the new settings tests and confirm the APIs are missing.
- [ ] Add `PersonalDashboardSettings { enabledCardKinds: DashboardCardKind[] }` with all currently supported kinds enabled by default to preserve existing behavior.
- [ ] Persist it in `ConfigurationSnapshot`, expose it through `ProjectManager`, and add `savePersonalDashboardSettings()`.
- [ ] Add a personal-card-type section under **配置 → 视图显示** with one toggle per kind.
- [ ] Filter the blank-workspace context menu using the saved enabled-kind set; existing cards remain visible and editable if a kind is later disabled.
- [ ] Re-run settings and registry tests.

### Task 6: Markdown text cards and dependency-free chart cards

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Create: `src/views/dashboard-modules/text-card.ts`
- Create: `src/views/dashboard-modules/chart-model.ts`
- Create: `src/views/dashboard-modules/chart-card.ts`
- Modify: `src/views/dashboard-modules/registry.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `styles.css`
- Test: `tests/views/dashboard-text-card.test.ts`
- Test: `tests/views/dashboard-chart-model.test.ts`

- [ ] Add failing tests for Markdown configuration, CSV parsing, validation, line/bar coordinates, pie-slice angles, and safe empty/error states.
- [ ] Run the text/chart tests and confirm the new kinds are missing.
- [ ] Add a text card with a normal card name plus Markdown body rendered through Obsidian `MarkdownRenderer` without raw remote scripts.
- [ ] Add line, bar, and pie chart configurations; accept editable table rows and pasted CSV, with multiple series for line/bar and one series for pie.
- [ ] Render charts as local SVG with theme variables, accessible labels, responsive view boxes, and no charting dependency.
- [ ] Register both kinds and include them in the card-type availability settings.
- [ ] Re-run all dashboard tests.

### Task 7: Full verification, deployment, and SSH push

**Files:**
- Modify: `README.md`
- Modify: `docs/user-guide.md`

- [ ] Document provider privacy, API-key storage, excluded directories, card backgrounds, type availability, Markdown text, and chart input.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit --skipLibCheck`, and `git diff --check`.
- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` and confirm deployment to `.obsidian/plugins/obsidian-project`.
- [ ] Commit the implementation and push `feature/personal-dashboard-modules` through the SSH remote.
