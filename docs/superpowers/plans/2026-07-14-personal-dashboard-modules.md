# Personal Dashboard Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently configurable weather, calendar, note statistics, recent files, news, and directory cards to the personal dashboard.

**Architecture:** Extend the persisted dashboard card kind and `moduleConfig`, normalize every module configuration through pure functions, and dispatch rendering/settings through a small module registry. Local modules use only Obsidian Vault APIs; weather and news use `requestUrl` only after per-card opt-in and cache successful responses in memory.

**Tech Stack:** TypeScript, Obsidian API, esbuild, Vitest, CSS container queries, Open-Meteo, RSS/Atom XML.

---

### Task 1: Persisted module catalog and configuration

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-layout.ts`
- Create: `src/views/dashboard-modules/config.ts`
- Test: `tests/views/dashboard-module-config.test.ts`

- [ ] Write tests asserting all six kinds, default sizes, configuration normalization, network defaults disabled, and unknown fields removed.
- [ ] Run `npx vitest run tests/views/dashboard-module-config.test.ts` and confirm missing exports fail.
- [ ] Add `DashboardModuleKind`, typed module configuration interfaces, `moduleConfig`, `DASHBOARD_MODULE_CATALOG`, and `normalizeDashboardModuleConfig`.
- [ ] Update layout normalization and card creation to preserve configurations and apply module default sizes.
- [ ] Run the test and confirm it passes.
- [ ] Commit with `git commit -am "feat: add dashboard module configuration"` after staging new files.

### Task 2: Module registry and card settings dispatch

**Files:**
- Create: `src/views/dashboard-modules/types.ts`
- Create: `src/views/dashboard-modules/registry.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `src/views/personal-view.ts`
- Test: `tests/views/dashboard-module-registry.test.ts`

- [ ] Write tests asserting the six definitions, menu labels, icons, render dispatch, and module-specific settings dispatch.
- [ ] Run the test and confirm registry exports are missing.
- [ ] Define `DashboardModuleDefinition` with `render` and `renderSettings`, create the registry, and route module cards from `PersonalView`.
- [ ] Extend the workspace context menu and card-kind dropdown while keeping number, percentage, and task-list behavior unchanged.
- [ ] Run registry and existing dashboard tests.
- [ ] Commit with `git commit -am "feat: register personal dashboard modules"` after staging new files.

### Task 3: Calendar card

**Files:**
- Create: `src/views/dashboard-modules/calendar-card.ts`
- Create: `src/views/dashboard-modules/calendar-model.ts`
- Test: `tests/views/dashboard-calendar-module.test.ts`
- Modify: `styles.css`

- [ ] Write tests for Monday-first month cells, adjacent-month padding, today detection, fixed holidays, and Chinese lunar labels through `Intl.DateTimeFormat`.
- [ ] Run the test and confirm model functions are missing.
- [ ] Implement pure calendar functions and render month navigation, weekdays, today, holiday, and optional lunar labels.
- [ ] Add compact, standard, and wide container-query layouts.
- [ ] Run calendar and personal layout tests.
- [ ] Commit with `git commit -am "feat: add personal calendar card"` after staging new files.

### Task 4: Vault statistics, recent files, and directory cards

**Files:**
- Create: `src/views/dashboard-modules/vault-data.ts`
- Create: `src/views/dashboard-modules/note-stats-card.ts`
- Create: `src/views/dashboard-modules/recent-files-card.ts`
- Create: `src/views/dashboard-modules/directory-card.ts`
- Test: `tests/views/dashboard-vault-modules.test.ts`
- Modify: `styles.css`

- [ ] Write tests for note/character/folder totals, Top 5 folders, recent-file ordering/limits, relative times, root filtering, and directory tree construction.
- [ ] Run the test and confirm the pure functions are missing.
- [ ] Implement pure aggregation functions, then render cards using `getMarkdownFiles`, `cachedRead`, `TFile`, and `TFolder` without accessing outside the Vault.
- [ ] Add file opening, folder expansion, loading/empty states, and responsive list density.
- [ ] Run module tests and the full selector/index suite.
- [ ] Commit with `git commit -am "feat: add local vault dashboard cards"` after staging new files.

### Task 5: Weather card with explicit network opt-in

**Files:**
- Create: `src/views/dashboard-modules/weather-service.ts`
- Create: `src/views/dashboard-modules/weather-card.ts`
- Test: `tests/views/dashboard-weather-module.test.ts`
- Modify: `styles.css`

- [ ] Write tests for the disabled state, Open-Meteo URL generation, response normalization, weather-code presentation, three-day forecasts, and cache expiry.
- [ ] Run the test and confirm service functions are missing.
- [ ] Implement an injected request function for tests and `requestUrl` in production, keyed in-memory caching, stale-result protection, manual refresh, and clear errors.
- [ ] Render current conditions and a three-day forecast; configure location name, latitude, longitude, refresh interval, and network toggle.
- [ ] Run weather tests without making real network calls.
- [ ] Commit with `git commit -am "feat: add opt-in weather dashboard card"` after staging new files.

### Task 6: News card with safe RSS/Atom parsing

**Files:**
- Create: `src/views/dashboard-modules/news-service.ts`
- Create: `src/views/dashboard-modules/news-card.ts`
- Test: `tests/views/dashboard-news-module.test.ts`
- Modify: `styles.css`

- [ ] Write tests for disabled networking, RSS and Atom fixtures, entity decoding, date sorting, pagination, invalid feeds, and HTML removal.
- [ ] Run the test and confirm parser functions are missing.
- [ ] Implement local XML parsing without remote scripts, use text-only rendering, cache by feed URL, and open external links with `noopener`.
- [ ] Configure feed URLs, page size, refresh interval, and network opt-in; render pagination and per-feed errors.
- [ ] Run news tests without making real network calls.
- [ ] Commit with `git commit -am "feat: add opt-in news dashboard card"` after staging new files.

### Task 7: Integrated presentation, lifecycle, and migration validation

**Files:**
- Modify: `src/views/personal-view.ts`
- Modify: `src/modals/dashboard-card-settings-modal.ts`
- Modify: `styles.css`
- Modify: `tests/views/personal-layout.test.ts`
- Modify: `tests/views/dashboard-layout.test.ts`

- [ ] Add failing regression tests for cloned module instances, independent settings, legacy layouts, async results after card removal, mobile widths, and resize spans.
- [ ] Implement render-generation guards and shared loading/error/empty presentation.
- [ ] Apply a restrained editorial dashboard style using theme variables, solid surfaces, clear typography, and container queries.
- [ ] Run `npm test`, `npx tsc --noEmit --skipLibCheck`, `npm run lint`, and `git diff --check`.
- [ ] Commit with `git commit -am "feat: complete modular personal dashboard"`.

### Task 8: Build, deploy, runtime verification, and SSH push

**Files:**
- Modify if needed: `tests/e2e/manual-checklist.md`

- [ ] Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build` and confirm deployment to `.obsidian/plugins/obsidian-project`.
- [ ] Verify all nine card kinds can be added, configured, moved, resized, cloned, and deleted.
- [ ] Verify local modules work offline and weather/news do not request data before opt-in.
- [ ] Check error-level console output; if the installed Obsidian CLI remains unsupported, record the manual reload limitation.
- [ ] Push with `git push -u origin feature/personal-dashboard-modules`.
