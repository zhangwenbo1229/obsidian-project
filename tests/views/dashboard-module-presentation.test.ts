import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DASHBOARD_MODULE_DEFINITIONS } from '../../src/views/dashboard-modules/registry';

const registry = readFileSync(new URL('../../src/views/dashboard-modules/registry.ts', import.meta.url), 'utf8');
const weather = readFileSync(new URL('../../src/views/dashboard-modules/weather-card.ts', import.meta.url), 'utf8');
const news = readFileSync(new URL('../../src/views/dashboard-modules/news-card.ts', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../../src/views/dashboard-modules/calendar-card.ts', import.meta.url), 'utf8');
const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
const heatmap = readFileSync(new URL('../../src/views/dashboard-modules/heatmap-card.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const chart = readFileSync(new URL('../../src/views/dashboard-modules/chart-card.ts', import.meta.url), 'utf8');
const todo = readFileSync(new URL('../../src/views/dashboard-modules/todo-card.ts', import.meta.url), 'utf8');

describe('dashboard module presentation', () => {
	it('keeps the todo inline editor aligned with the content grid column', () => {
		expect(css).toMatch(/\.op-todo-inline-editor[^{]*\{[^}]*min-width:\s*0[^}]*width:\s*100%/u);
		expect(todo).toContain('text.insertAdjacentElement');
	});
	it('uses dedicated renderers for all custom module cards', () => {
		for (const name of ['weatherDefinition', 'calendarDefinition', 'noteStatsDefinition', 'recentFilesDefinition', 'newsDefinition', 'directoryDefinition', 'textDefinition', 'chartDefinition']) {
			expect(registry).toContain(name);
		}
		expect(DASHBOARD_MODULE_DEFINITIONS).toHaveLength(17);
	});

	it('renders configured web widgets in a lazy sandboxed iframe', () => {
		const iframeUrl = new URL('../../src/views/dashboard-modules/iframe-card.ts', import.meta.url);
		expect(existsSync(iframeUrl)).toBe(true);
		if (!existsSync(iframeUrl)) return;
		const iframe = readFileSync(iframeUrl, 'utf8');
		expect(iframe).toContain("createEl('iframe'");
		expect(iframe).toContain("sandbox: 'allow-forms allow-popups allow-scripts allow-same-origin'");
		expect(iframe).toContain("referrerpolicy: 'no-referrer'");
		expect(iframe).toContain("loading: 'lazy'");
		expect(css).toContain('.op-iframe-card-frame');
		expect(iframe).toContain('ResizeObserver');
		expect(iframe).toContain('clientWidth');
		expect(iframe).toContain('clientHeight');
		expect(iframe).toContain('context.component.register');
		expect(css).not.toMatch(/\.op-iframe-card-frame\s*\{[^}]*min-height:\s*220px/u);
		expect(css).toMatch(/\.op-dashboard-module-card\.is-iframe\s*\{[^}]*padding:\s*0[^}]*background:\s*transparent/u);
		expect(personal).toContain('op-dashboard-drag-handle');
		expect(personal).toContain("setIcon(dragHandle, 'grip-horizontal')");
		expect(personal).toContain("setIcon(handle, 'move-diagonal-2')");
		expect(css).toMatch(/\.op-dashboard-module-card\.is-iframe:hover \.op-dashboard-drag-handle[^}]*opacity:\s*1/u);
		expect(css).toMatch(/\.op-dashboard-module-card\.is-iframe:hover \.op-dashboard-resize-handle[^}]*opacity:\s*1/u);
	});

	it('builds the activity heatmap from every Vault file', () => {
		expect(heatmap).toContain('dashboardVaultCache.allFiles()');
		expect(heatmap).not.toContain('vault.getMarkdownFiles()');
		expect(heatmap).toContain("icon: 'layout-grid'");
	});

	it('keeps chart labels readable at regular and narrow card widths', () => {
		expect(css).toMatch(/\.op-chart-label\s*\{[^}]*font-size:\s*(?:11|12)px/u);
		expect(css).toMatch(/\.op-chart-data-label\s*\{[^}]*font-size:\s*(?:10|11)px/u);
		expect(css).toMatch(/\.op-chart-legend\s*\{[^}]*font-size:\s*(?:11|12)px/u);
		expect(css).not.toContain('.op-chart-label { display: none; }');
	});

	it('lets the chart canvas consume the available card body', () => {
		expect(css).toMatch(/\.op-chart-card\s*\{[^}]*flex:\s*1/u);
		expect(css).toMatch(/\.op-chart-svg\s*\{[^}]*min-height:\s*0/u);
		expect(chart).toContain("preserveAspectRatio: 'xMidYMid meet'");
		expect(chart).toContain('ResizeObserver');
		expect(chart).toContain('clientWidth');
	});

	it('uses the same semicircle gauge structure for percentage and check-in cards', () => {
		const checkIn = readFileSync(new URL('../../src/views/dashboard-modules/check-in-card.ts', import.meta.url), 'utf8');
		expect(personal).toContain('op-semicircle-gauge');
		expect(checkIn).toContain('op-semicircle-gauge');
		expect(css).toContain('.op-semicircle-gauge');
		expect(css).toMatch(/\.op-check-in-progress\.is-linear\s*>\s*span\s*\{/u);
		expect(css).not.toMatch(/\.op-check-in-progress\s*>\s*span\s*\{/u);
		expect(css).toMatch(/\.op-semicircle-gauge-track\s*\{[^}]*width:\s*100%/u);
	});

	it('renders a configurable icon for calendar check-in data', () => {
		expect(calendar).toContain('config.checkInIcon');
		expect(calendar).toContain('setIcon');
	});

	it('edits and completes todos without exposing source paths', () => {
		expect(todo).toContain('op-todo-text');
		expect(todo).toContain("text.addEventListener('dblclick'");
		expect(todo).toContain("checkbox.addEventListener('change'");
		expect(todo).not.toContain('op-todo-source');
		expect(todo).not.toContain('打开来源');
		expect(todo).not.toContain('openTimer');
		expect(todo).not.toContain('window.setTimeout');
	});

	it('uses four visibly distinct heatmap intensity levels', () => {
		for (const level of [1, 2, 3, 4]) expect(css).toContain(`.op-heatmap-cell.is-level-${level}`);
		expect(css).toMatch(/\.op-heatmap-cell\.is-level-1\s*\{[^}]*28%/u);
		expect(css).toMatch(/\.op-heatmap-cell\.is-level-4\s*\{[^}]*100%/u);
	});

	it('keeps todo text immediately left-aligned beside its checkbox', () => {
		expect(css).toMatch(/\.op-todo-item\s*>\s*\.op-todo-checkbox\s*\{[^}]*grid-column:\s*1/u);
		expect(css).toMatch(/\.op-todo-item\s*>\s*\.op-todo-content\s*\{[^}]*grid-column:\s*2/u);
		expect(css).toMatch(/\.op-todo-text\s*\{[^}]*justify-content:\s*stretch[^}]*justify-items:\s*start/u);
		expect(css).toMatch(/\.op-todo-item,\s*\.op-todo-text\s*\{[^}]*box-shadow:\s*none\s*!important/u);
	});

	it('keeps weather and news disabled until the user opts in', () => {
		expect(weather).toContain('networkEnabled');
		expect(weather).toContain('未启用联网');
		expect(news).toContain('networkEnabled');
		expect(news).toContain('未启用联网');
		expect(news).toContain("rel: 'noopener noreferrer'");
	});

	it('provides responsive styles for every module family', () => {
		for (const className of [
			'.op-dashboard-module-card', '.op-weather-card', '.op-module-calendar-grid',
			'.op-note-stats-grid', '.op-recent-files-list', '.op-news-list', '.op-directory-tree',
		]) expect(css).toContain(className);
		expect(css).toContain('@container');
	});

	it('ignores async module results after the dashboard has rerendered', () => {
		expect(personal).toContain('renderGeneration');
		expect(personal).toContain('isCurrent');
		expect(weather).toContain('context.isCurrent()');
		expect(news).toContain('context.isCurrent()');
	});

	it('keeps the active calendar month in the heading and allows resized cards to scroll', () => {
		expect(calendar).toContain('op-dashboard-module-subtitle');
		expect(calendar).toContain('ganzhiYear');
		expect(calendar).not.toContain('op-module-calendar-caption');
		expect(css).toMatch(/\.op-calendar-card\s*\{[^}]*overflow:\s*auto/u);
		expect(css).toMatch(/\.op-module-calendar-grid\s*\{[^}]*min-width:/u);
		expect(css).toMatch(/\.op-dashboard-module-card\.is-calendar \.op-dashboard-module-subtitle\s*\{[^}]*display:\s*inline/u);
		expect(css).not.toContain('.op-module-calendar-annotation { display: none; }');
	});
});
