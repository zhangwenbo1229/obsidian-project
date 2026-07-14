import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeConfigurationSnapshot, type ConfigurationSnapshot } from '../../src/settings/configuration-store';
import {
	ALL_DASHBOARD_CARD_KINDS,
	normalizePersonalDashboardSettings,
} from '../../src/views/personal-dashboard-settings';

const legacy: ConfigurationSnapshot = {
	globalConfig: {
		kind: 'global-config', schema: 1, projectConfigDirectory: 'projects', defaultTaskDirectory: 'tasks',
		currentUserId: 'user', people: [{ id: 'user', name: '用户', active: true }],
	},
	projects: [],
	tagOrder: [],
};

describe('personal dashboard settings', () => {
	it('enables every supported card kind when migrating legacy configuration', () => {
		expect(normalizePersonalDashboardSettings(undefined).enabledCardKinds).toEqual(ALL_DASHBOARD_CARD_KINDS);
		expect(normalizeConfigurationSnapshot(legacy).personalDashboardSettings.enabledCardKinds).toEqual(ALL_DASHBOARD_CARD_KINDS);
		expect(normalizePersonalDashboardSettings(undefined).weatherCredentials).toEqual({
			qweatherApiKey: '',
			qweatherApiHost: '',
			openWeatherMapApiKey: '',
		});
		expect(normalizePersonalDashboardSettings(undefined).fileOpenCounts).toEqual({});
	});

	it('normalizes bounded file open counters', () => {
		expect(normalizePersonalDashboardSettings({
			fileOpenCounts: { 'a.md': 3.8, ' b.md ': -2, '': 9, 'c.md': 99_999_999 },
		}).fileOpenCounts).toEqual({ 'a.md': 3, 'c.md': 1_000_000 });
	});

	it('deduplicates configured kinds, removes unknown kinds, and preserves an explicit empty selection', () => {
		expect(normalizePersonalDashboardSettings({
			enabledCardKinds: ['calendar', 'unknown', 'calendar', 'weather'],
			weatherCredentials: {
				qweatherApiKey: ' secret ',
				qweatherApiHost: 'https://abc.re.qweatherapi.com/path',
				openWeatherMapApiKey: ' open-weather ',
			},
		})).toEqual({
			enabledCardKinds: ['calendar', 'weather'],
			fileOpenCounts: {},
			weatherCredentials: {
				qweatherApiKey: 'secret',
				qweatherApiHost: 'https://abc.re.qweatherapi.com',
				openWeatherMapApiKey: 'open-weather',
			},
		});
		expect(normalizePersonalDashboardSettings({ enabledCardKinds: [] })).toMatchObject({ enabledCardKinds: [] });
	});

	it('rejects non-HTTPS weather hosts and keeps weather secrets on the dedicated settings page', () => {
		expect(normalizePersonalDashboardSettings({
			weatherCredentials: { qweatherApiHost: 'http://example.com' },
		}).weatherCredentials.qweatherApiHost).toBe('');
		const settings = readFileSync(new URL('../../src/settings/settings-tab.ts', import.meta.url), 'utf8');
		const editor = readFileSync(new URL('../../src/settings/personal-dashboard-settings-editor.ts', import.meta.url), 'utf8');
		expect(settings).toContain("'personal-dashboard'");
		expect(settings).toContain('renderPersonalDashboard');
		expect(editor).toContain('和风天气接口密钥');
		expect(editor).toContain('开放天气地图接口密钥');
	});

	it('migrates credentials from legacy weather cards into global personal settings', () => {
		const snapshot = normalizeConfigurationSnapshot({
			...legacy,
			personalDashboardLayout: [
				{ id: 'q', kind: 'weather', moduleConfig: { provider: 'qweather', apiKey: ' q-key ', apiHost: 'https://api.example.com/path' } },
				{ id: 'o', kind: 'weather', moduleConfig: { provider: 'openweathermap', apiKey: ' o-key ' } },
			] as never[],
		});
		expect(snapshot.personalDashboardSettings.weatherCredentials).toEqual({
			qweatherApiKey: 'q-key',
			qweatherApiHost: 'https://api.example.com',
			openWeatherMapApiKey: 'o-key',
		});
		for (const card of snapshot.personalDashboardLayout) {
			expect('apiKey' in (card.moduleConfig ?? {})).toBe(false);
			expect('apiHost' in (card.moduleConfig ?? {})).toBe(false);
		}
	});

	it('persists settings through the manager and filters the personal workspace menu', () => {
		const manager = readFileSync(new URL('../../src/services/project-manager.ts', import.meta.url), 'utf8');
		const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
		const settings = readFileSync(new URL('../../src/settings/settings-tab.ts', import.meta.url), 'utf8');
		expect(manager).toContain('savePersonalDashboardSettings');
		expect(personal).toContain('enabledCardKinds');
		expect(personal).toContain('isCardKindEnabled');
		expect(settings).toContain('PersonalDashboardSettingsEditor');
	});
});
