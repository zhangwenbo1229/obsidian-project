import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDashboardCard, normalizeDashboardLayout } from '../../src/views/dashboard-layout';
import {
	DASHBOARD_MODULE_CATALOG,
	normalizeDashboardModuleConfig,
} from '../../src/views/dashboard-modules/config';

describe('personal dashboard module configuration', () => {
	it('catalogs every module with practical default card sizes', () => {
		expect(DASHBOARD_MODULE_CATALOG.map((item) => item.kind)).toEqual([
			'weather', 'calendar', 'date', 'todo', 'note-stats', 'recent-files', 'news', 'directory', 'text', 'chart',
			'countdown', 'heatmap',
		]);
		expect(DASHBOARD_MODULE_CATALOG.find((item) => item.kind === 'calendar')?.defaultSize).toEqual({ columns: 2, rows: 3 });
		expect(DASHBOARD_MODULE_CATALOG.find((item) => item.kind === 'weather')?.icon).toBe('cloud-sun');
	});

	it('normalizes safe defaults and keeps network modules disabled', () => {
		expect(normalizeDashboardModuleConfig('weather', null)).toEqual({
			networkEnabled: false,
			provider: 'open-meteo',
			locationName: '上海',
			latitude: 31.2304,
			longitude: 121.4737,
			forecastDays: 3,
			refreshMinutes: 30,
		});
		expect(normalizeDashboardModuleConfig('news', { networkEnabled: true, feedUrls: [' https://example.com/rss ', 'file:///secret', 'not-a-url', ''], pageSize: 99 })).toEqual({
			networkEnabled: true,
			feedUrls: ['https://example.com/rss'],
			pageSize: 12,
			refreshMinutes: 30,
		});
		expect(normalizeDashboardModuleConfig('directory', { rootPaths: [' 工作 ', ''], maxDepth: 99 })).toEqual({
			rootPaths: ['工作'],
			maxDepth: 8,
		});
		expect(normalizeDashboardModuleConfig('note-stats', { rootPath: 'Notes', excludePaths: [' Notes/Archive ', ''] })).toMatchObject({
			rootPath: 'Notes',
			excludePaths: ['Notes/Archive'],
		});
		expect(normalizeDashboardModuleConfig('recent-files', { excludePaths: ['Templates'] })).toMatchObject({
			excludePaths: ['Templates'],
		});
		expect(normalizeDashboardModuleConfig('calendar', {})).toEqual({
			showLunar: true,
			showHolidays: true,
			weekStartsOn: 1,
		});
		expect(normalizeDashboardModuleConfig('date', {})).toEqual({
			showLunar: true, showHoliday: true, showTime: true, showWeekday: true, showSeconds: true,
		});
		expect(normalizeDashboardModuleConfig('todo', { rootPaths: [' Work ', ''], excludePaths: ['Work/Archive'], limit: 999 })).toEqual({
			rootPaths: ['Work'], excludePaths: ['Work/Archive'], limit: 100, showSource: true,
		});
		expect(normalizeDashboardModuleConfig('countdown', {})).toMatchObject({
			eventName: '目标日', includeToday: false, showTargetDate: true,
		});
		expect(normalizeDashboardModuleConfig('heatmap', { days: 999, color: 'bad' })).toMatchObject({
			days: 365, color: '#22a06b', rootPaths: [], excludePaths: [],
		});
		expect(normalizeDashboardModuleConfig('chart', {})).toMatchObject({
			showAxes: true, showLegend: true, showDataLabels: false,
			axisColor: '#8590a2', legendColor: '#626f86', dataLabelColor: '#44546f',
		});
	});

	it('creates and migrates independently configured module cards', () => {
		const weather = createDashboardCard('weather-card', 'weather', 7);
		expect(weather).toMatchObject({
			kind: 'weather', columnSpan: 2, rowSpan: 2,
			moduleConfig: { networkEnabled: false, locationName: '上海' },
		});
		const normalized = normalizeDashboardLayout([{
			...weather,
			moduleConfig: { networkEnabled: true, latitude: 200, longitude: -500, refreshMinutes: 1 },
		}] as never[]);
		expect(normalized.find((card) => card.id === 'weather-card')?.moduleConfig).toMatchObject({
			networkEnabled: true, latitude: 90, longitude: -180, forecastDays: 3, refreshMinutes: 10,
		});
		expect(normalizeDashboardModuleConfig('weather', { forecastDays: 99 })).toMatchObject({ forecastDays: 7 });
		const legacyWeather = normalizeDashboardModuleConfig('weather', {
			provider: 'qweather', apiKey: ' legacy-secret ', apiHost: ' https://abc.re.qweatherapi.com/ ',
		});
		expect('apiKey' in legacyWeather).toBe(false);
		expect('apiHost' in legacyWeather).toBe(false);
		expect(normalizeDashboardModuleConfig('weather', { provider: 'invalid' })).toMatchObject({ provider: 'open-meteo' });
	});

	it('keeps weather credentials out of per-card settings', () => {
		const settings = readFileSync(new URL('../../src/views/dashboard-modules/module-settings.ts', import.meta.url), 'utf8');
		expect(settings).not.toContain("setName('接口密钥')");
		expect(settings).not.toContain("setName('接口主机')");
	});
});
