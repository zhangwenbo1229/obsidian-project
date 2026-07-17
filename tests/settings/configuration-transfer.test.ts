import { describe, expect, it } from 'vitest';
import type { ConfigurationSnapshot } from '../../src/settings/configuration-store';
import { createConfigurationExportEnvelope, parseConfigurationImport, serializeConfigurationExport } from '../../src/settings/configuration-transfer';

const snapshot: ConfigurationSnapshot = {
	globalConfig: {
		kind: 'global-config', schema: 1, projectConfigDirectory: 'plugin-data', defaultTaskDirectory: 'tasks',
		currentUserId: '550e8400-e29b-41d4-a716-446655440000',
		people: [{ id: '550e8400-e29b-41d4-a716-446655440000', name: 'User', active: true }],
		personMetadataFields: [],
	},
	projects: [], tagOrder: [], tagStyles: {}, tagGroups: [], tagGroupAssignments: {}, taskTemplates: [],
	savedProjectFilters: [], personalDashboardLayout: [],
	personalDashboardSettings: {
		enabledCardKinds: ['task-list'], fileOpenCounts: {}, checkInHistories: {}, openPersonalDashboardOnStartup: false,
		weatherCredentials: { qweatherApiKey: 'secret', qweatherApiHost: 'https://api.example.com', openWeatherMapApiKey: 'secret-2' },
	},
};

describe('configuration transfer', () => {
	it('exports a versioned envelope and redacts credentials by default', () => {
		const exported = createConfigurationExportEnvelope(snapshot, new Date('2026-07-15T00:00:00Z'));
		expect(exported).toMatchObject({ format: 'obsidian-project-configuration', version: 1, exportedAt: '2026-07-15T00:00:00.000Z' });
		expect(exported.configuration.personalDashboardSettings.weatherCredentials.qweatherApiKey).toBe('');
		expect(exported.configuration.personalDashboardSettings.weatherCredentials.qweatherApiHost).toBe('https://api.example.com');
	});

	it('can explicitly include credentials', () => {
		const exported = createConfigurationExportEnvelope(snapshot, new Date(), { includeSecrets: true });
		expect(exported.configuration.personalDashboardSettings.weatherCredentials.openWeatherMapApiKey).toBe('secret-2');
	});

	it('parses and normalizes a valid export', () => {
		const imported = parseConfigurationImport(serializeConfigurationExport(snapshot));
		expect(imported.configuration.globalConfig.defaultTaskDirectory).toBe('tasks');
		expect(imported.summary).toMatchObject({ projects: 0, templates: 0, dashboardCards: 0 });
	});

	it('rejects malformed and unsupported exports before persistence', () => {
		expect(() => parseConfigurationImport('{')).toThrow('不是有效的 JSON');
		expect(() => parseConfigurationImport(JSON.stringify({ format: 'obsidian-project-configuration', version: 2, configuration: snapshot }))).toThrow('不支持的配置版本');
	});
});
