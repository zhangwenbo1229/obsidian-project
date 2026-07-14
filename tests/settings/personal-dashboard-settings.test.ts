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
	});

	it('deduplicates configured kinds, removes unknown kinds, and preserves an explicit empty selection', () => {
		expect(normalizePersonalDashboardSettings({ enabledCardKinds: ['calendar', 'unknown', 'calendar', 'weather'] })).toEqual({
			enabledCardKinds: ['calendar', 'weather'],
		});
		expect(normalizePersonalDashboardSettings({ enabledCardKinds: [] })).toEqual({ enabledCardKinds: [] });
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
