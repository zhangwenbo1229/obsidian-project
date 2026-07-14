# View Layout, Settings Pages, and Personal Filters Implementation Plan

> **For agentic workers:** Implement inline in this session. Follow test-driven development for each behavior and do not commit generated artifacts.

**Goal:** Fix task-card overlap, centralize all configuration in paged settings, and add a collapsible personal-view filter sidebar.

**Architecture:** Keep filtering as pure selector functions, keep view state inside `PersonalView`, and extract project configuration rendering into a reusable settings editor. The settings tab owns page navigation and embeds the editor so configuration no longer opens a separate modal.

**Tech Stack:** TypeScript, Obsidian API, CSS, Vitest, npm, esbuild.

---

### Task 1: Card layout regression

**Files:**
- Create: `tests/views/card-layout.test.ts`
- Modify: `styles.css`

- [ ] Add a failing structural CSS test for natural-height task and board cards.
- [ ] Run the targeted test and confirm failure against the current fixed button height.
- [ ] Reset button height/min-height and use a content-safe grid layout.
- [ ] Run the targeted test and existing view tests.

### Task 2: Personal filter model

**Files:**
- Modify: `tests/views/selectors.test.ts`
- Modify: `src/views/selectors.ts`

- [ ] Add failing tests for today, Monday-to-Sunday week, month, missing start dates, tag OR, and cross-group AND behavior.
- [ ] Implement `PersonalStartPeriod`, `PersonalFilters`, and `filterPersonalTasks` using local ISO dates.
- [ ] Run selector tests and confirm all cases pass.

### Task 3: Personal filter sidebar

**Files:**
- Modify: `src/views/personal-view.ts`
- Modify: `styles.css`

- [ ] Add persistent-in-view sidebar open state, time period state, and selected tag state.
- [ ] Render an always-visible collapse control, time choices, and tag choices.
- [ ] Apply the filtered task set to statistics, overdue tasks, and pending tasks.
- [ ] Add responsive, accessible styling consistent with the existing workbench aesthetic.

### Task 4: Paged unified settings

**Files:**
- Create: `src/settings/settings-navigation.ts`
- Create: `tests/settings/settings-navigation.test.ts`
- Create: `src/settings/project-editor.ts`
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/modals/project-config-modal.ts`
- Modify: `styles.css`

- [ ] Add a failing navigation-model test covering general, people, projects, project detail, and back navigation.
- [ ] Implement the navigation model.
- [ ] Extract the existing project configuration form into a reusable editor rendered into a supplied element.
- [ ] Build settings navigation pages for general configuration, people, projects, and embedded project detail.
- [ ] Keep the legacy modal as a thin wrapper or remove its callers so there is one configuration surface.
- [ ] Add responsive settings-page styling.

### Task 5: Verification and deployment

**Files:**
- Verify all modified sources and generated deployment artifacts.

- [ ] Run targeted tests, then `npm test` and `npm run lint`.
- [ ] Run `npm run build` with `OBSIDIAN_VAULT_PATH=D:\\code\\obsidian\\test`; the build must deploy automatically.
- [ ] Reload the plugin through the running Obsidian debug endpoint.
- [ ] Inspect card geometry, personal filter behavior, settings pages, mobile layout, and console errors.
- [ ] Run `git diff --check` and compare source/deployed artifact hashes.
