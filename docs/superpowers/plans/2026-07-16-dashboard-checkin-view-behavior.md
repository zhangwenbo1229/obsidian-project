# Personal dashboard check-in and project view behavior plan

**Date:** 2026-07-16

## Evidence and root causes

- `main.ts` registers the personal dashboard view but has no layout-ready startup hook or persisted startup preference.
- Project-template UI still uses the legacy top-level “任务” wording. Persistent IDs and Markdown field keys must remain unchanged; only user-facing project-template copy changes to “项目”, while embedded subtasks are shown as “任务”.
- Task metadata settings currently expose ten fields. Tasks itself has no separate end-date token, but it does have the completion date (`✅`); expose that supported field to users as “结束日期”, alongside scheduled/due/start, and keep parsing legacy Tasks metadata.
- The calendar formatter concatenates lunar month and lunar day. Calendar cells should render only the normalized lunar day name such as “初一”“十一”“廿一”.
- Todo inline editing appends the input as a third grid child without assigning it to the content column, so it is laid out away from the checkbox.
- Task-view title click currently opens the modal while only double-click enters inline editing. Both click paths should converge on one guarded inline editor; the modal moves to a context-menu action.
- Project view behavior is hard-coded: board columns are workflow statuses/categories, calendar uses a fixed plan/deadline fallback, and quadrants use high priority plus a fixed three-day threshold. Existing project-view settings only persist field arrays.
- Embedded tasks currently render title and metadata in one flex row. Their click handlers do not consistently isolate task activation from the parent project card activation.

## Check-in widget research

- [Loop Habit Tracker](https://github.com/iSoron/uhabits) is privacy-first and local-first, tracks streak/history, and supports count-based habits. Adopt local storage, a per-day event list, a configurable daily target, and separate cumulative checked-in days from current-day progress.
- [Habity](https://github.com/manjeetdeswal/Habity-Habit-Tracker) uses a GitHub-style heatmap and emphasizes cloud-free local storage. Adopt a shared date-count source so the check-in card, calendar and heatmap render the same local data without network access.
- [Habit Commit](https://github.com/Refloow/Habit-Commit) uses color intensity to represent daily progress in a contribution-style calendar. Adopt normalized levels derived from `count / dailyTarget`, capped for visual display while retaining all timestamps.
- GitHub's contribution graph convention is used only as an interaction reference. No third-party source code or remote tracking service will be included.

## Data and compatibility design

1. Add `openPersonalDashboardOnStartup` to personal-dashboard settings, defaulting to `false`. Register `workspace.onLayoutReady` and open/reveal the view only when enabled.
2. Add dashboard module kind `check-in` with config `{ dailyTarget, buttonLabel, showStreak, showTotalDays }`. Persist check-in events in personal-dashboard settings as `Record<ISO date, ISO datetime[]>`; cap/normalize malformed imported data.
3. Add `dataSource: 'vault' | 'check-in'` to calendar and heatmap configs. The calendar marks daily progress when using check-in data; the heatmap uses check-in event counts. Existing cards default to vault/calendar behavior.
4. Reduce configurable task metadata to the four Tasks-compatible dates: `🛫` start, `✅` completion shown as “结束”, `⏳` scheduled shown as “计划”, and `📅` due shown as “截止”. Legacy created/cancelled/priority/tag/ID parsing remains intact but those values are no longer configurable/rendered by this settings page.
5. Extend project-view settings with normalized behavior rules:
   - board: configurable groups with status IDs, completed-column visibility, and automatic status update on drop;
   - calendar: selected date field and automatic date update on drop;
   - quadrants: important priority set and urgent-day threshold.
   Existing field arrays and old snapshots continue to normalize to defaults.

## Test-first implementation sequence

1. Add normalization and source-contract tests for the startup preference, startup hook, terminology and the four task dates; run the focused tests and confirm failure.
2. Add pure check-in model tests for event normalization, today progress, cumulative days and streak; add registry/config tests; confirm failure, then implement model, persistence, module UI and settings.
3. Add calendar/heatmap source tests proving check-in counts are reused, then add source selectors and settings controls.
4. Tighten lunar tests to reject month text in a cell label and assert canonical day names. Add the todo grid contract test. Implement only the confirmed formatter and CSS fixes.
5. Add task-view interaction source/DOM contracts for guarded click/double-click inline editing and an Obsidian context menu opening `EditSubtaskModal`.
6. Add pure normalization/classification/calendar-selection tests for each project-view behavior rule. Implement settings UI, then connect board/calendar/quadrant rendering and drag/drop.
7. Add presentation contracts for task title and metadata rows, propagation isolation, responsive card height, and project-card fallback activation. Refactor the shared embedded-task renderer and CSS.
8. Run all tests, lint and `git diff --check`. Run `npm run build` with `OBSIDIAN_VAULT_PATH=D:\\code\\obsidian\\test`; this build must finish by executing the deploy script. Restart the test vault and inspect Obsidian errors/console.

## Regression safeguards

- Do not rename persisted field IDs, command IDs, view types or plugin ID.
- Normalize old configuration snapshots rather than requiring manual migration.
- Preserve all unrelated dirty-worktree changes.
- Network remains opt-in only for existing weather/news cards; check-in data never leaves the vault plugin data.
- Board/calendar drag automation is disabled unless configured, and all writes use existing manager save/transition paths.
