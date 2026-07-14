import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DASHBOARD_MODULE_DEFINITIONS } from '../../src/views/dashboard-modules/registry';

const registry = readFileSync(new URL('../../src/views/dashboard-modules/registry.ts', import.meta.url), 'utf8');
const weather = readFileSync(new URL('../../src/views/dashboard-modules/weather-card.ts', import.meta.url), 'utf8');
const news = readFileSync(new URL('../../src/views/dashboard-modules/news-card.ts', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../../src/views/dashboard-modules/calendar-card.ts', import.meta.url), 'utf8');
const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
const heatmap = readFileSync(new URL('../../src/views/dashboard-modules/heatmap-card.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('dashboard module presentation', () => {
	it('uses dedicated renderers for all six custom module cards', () => {
		for (const name of ['weatherDefinition', 'calendarDefinition', 'noteStatsDefinition', 'recentFilesDefinition', 'newsDefinition', 'directoryDefinition', 'textDefinition', 'chartDefinition']) {
			expect(registry).toContain(name);
		}
		expect(DASHBOARD_MODULE_DEFINITIONS).toHaveLength(12);
	});

	it('builds the activity heatmap from every Vault file', () => {
		expect(heatmap).toContain('vault.getFiles()');
		expect(heatmap).not.toContain('vault.getMarkdownFiles()');
	});

	it('keeps chart labels readable at regular and narrow card widths', () => {
		expect(css).toMatch(/\.op-chart-label\s*\{[^}]*font-size:\s*(?:11|12)px/u);
		expect(css).toMatch(/\.op-chart-data-label\s*\{[^}]*font-size:\s*(?:10|11)px/u);
		expect(css).toMatch(/\.op-chart-legend\s*\{[^}]*font-size:\s*(?:11|12)px/u);
		expect(css).not.toContain('.op-chart-label { display: none; }');
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
