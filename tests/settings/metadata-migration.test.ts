import { describe, expect, it } from 'vitest';
import { createUuid } from '../../src/utils/ids';
import { normalizeConfigurationSnapshot, type ConfigurationSnapshot } from '../../src/settings/configuration-store';

function makePersonMetadataField(key: string, name: string) {
	return { id: createUuid(), key, title: name, type: 'text' as const, icon: 'user', color: '#333333', required: false, active: true, sourceProperty: key, options: [] };
}

function makeTaskCustomField(key: string, name: string) {
	return { id: key, key, name, type: 'text' as const, required: false, defaultValue: null, icon: 'brackets', color: '#626f86', showInTaskView: true, showInProjectCards: true };
}

function makeTemplateCustomField(key: string, name: string) {
	return { id: createUuid(), key, name, type: 'text' as const, required: false, active: true, icon: 'brackets', color: '#626f86', default: null, taskTypeIds: [], options: [] };
}

function buildSnapshot(overrides: Partial<ConfigurationSnapshot> = {}): ConfigurationSnapshot {
	return {
		configurationSchema: 2,
		globalConfig: {
			kind: 'global-config' as const,
			schema: 1,
			projectConfigDirectory: 'global',
			defaultTaskDirectory: 'tasks',
			currentUserId: 'u1',
			people: [],
			personMetadataFields: [],
			unifiedMetadataFields: [],
			personMetadataRefs: [],
		},
		projects: [],
		tagOrder: [],
		personalDashboardLayout: [],
		...overrides,
	};
}

describe('metadata migration', () => {
	it('migrates person metadata fields to unified pool', () => {
		const personField = makePersonMetadataField('email', '邮箱');
		const snapshot = buildSnapshot({
			globalConfig: {
				kind: 'global-config',
				schema: 1,
				projectConfigDirectory: 'global',
				defaultTaskDirectory: 'tasks',
				currentUserId: 'u1',
				people: [],
				personMetadataFields: [personField],
			},
		});
		const result = normalizeConfigurationSnapshot(snapshot);
		expect(result.globalConfig.unifiedMetadataFields).toHaveLength(1);
		expect(result.globalConfig.unifiedMetadataFields![0]!.key).toBe('email');
		expect(result.globalConfig.unifiedMetadataFields![0]!.name).toBe('邮箱');
		expect(result.globalConfig.personMetadataRefs).toHaveLength(1);
		expect(result.globalConfig.personMetadataRefs![0]!.unifiedMetadataFieldId).toBe(result.globalConfig.unifiedMetadataFields![0]!.id);
		expect(result.globalConfig.personMetadataRefs![0]!.sourceProperty).toBe('email');
	});

	it('migrates task metadata custom fields to unified pool', () => {
		const taskField = makeTaskCustomField('severity', '严重程度');
		const snapshot = buildSnapshot({
			configurationSchema: 2,
			taskMetadataSettings: {
				fields: {
					scheduledDate: { enabled: true, icon: 'calendar-range', color: '#0c66e4', required: false, showInTaskView: true, showInProjectCards: true },
					dueDate: { enabled: true, icon: 'calendar-clock', color: '#c9372c', required: false, showInTaskView: true, showInProjectCards: true },
					startDate: { enabled: true, icon: 'plane-takeoff', color: '#227d9b', required: false, showInTaskView: true, showInProjectCards: true },
					doneDate: { enabled: true, icon: 'circle-check', color: '#1f845a', required: false, showInTaskView: true, showInProjectCards: true },
				},
				customFields: [taskField],
			},
		});
		const result = normalizeConfigurationSnapshot(snapshot);
		expect(result.globalConfig.unifiedMetadataFields).toHaveLength(1);
		expect(result.globalConfig.unifiedMetadataFields![0]!.key).toBe('severity');
		expect(result.globalConfig.unifiedMetadataFields![0]!.name).toBe('严重程度');
		expect(result.taskMetadataSettings.customFields).toHaveLength(0);
	});

	it('migrates template custom fields to unified pool', () => {
		const templateField = makeTemplateCustomField('priority', '优先级');
		const snapshot = buildSnapshot({
			projects: [{
				uid: 'proj1', name: 'test', code: 'TEST', active: true, kind: 'project' as const, schema: 1 as const, groupByMonth: false, nextNumber: 1,
				taskTypes: [{
					id: 'task', name: '任务', active: true,
					template: null, icon: 'check', color: '#0c66e4',
					fieldConfig: {
						title: { enabled: true, required: true, icon: 'heading', color: '#172b4d' },
						priority: { enabled: true, required: true, icon: 'flag', color: '#626f86' },
						reporter: { enabled: true, required: true, icon: 'user', color: '#626f86' },
						assignee: { enabled: true, required: false, icon: 'user-check', color: '#626f86' },
						scheduledDate: { enabled: true, required: false, icon: 'calendar-range', color: '#0c66e4' },
						startDate: { enabled: true, required: false, icon: 'plane-takeoff', color: '#227d9b' },
						dueDate: { enabled: true, required: false, icon: 'calendar-clock', color: '#c9372c' },
						endDate: { enabled: true, required: false, icon: 'flag-checkered', color: '#1f845a' },
						tags: { enabled: true, required: false, icon: 'tags', color: '#626f86' },
						body: { enabled: true, required: false, icon: 'file-text', color: '#626f86' },
						links: { enabled: true, required: false, icon: 'link', color: '#626f86' },
						subtasks: { enabled: true, required: false, icon: 'list-checks', color: '#626f86' },
						relations: { enabled: true, required: false, icon: 'git-branch', color: '#626f86' },
						notes: { enabled: true, required: false, icon: 'message-square', color: '#626f86' },
					},
				}],
				workflow: { initialStatusId: 'todo', statuses: [], transitions: [] },
				customFields: [templateField],
				taskDirectory: '.', templateIds: [],
			}],
		});
		const result = normalizeConfigurationSnapshot(snapshot);
		expect(result.globalConfig.unifiedMetadataFields).toHaveLength(1);
		expect(result.globalConfig.unifiedMetadataFields![0]!.key).toBe('priority');
	});

	it('deduplicates by key when merging from multiple sources', () => {
		const personField = makePersonMetadataField('email', '邮箱');
		const taskField = makeTaskCustomField('email', '电子邮箱');
		const snapshot = buildSnapshot({
			globalConfig: {
				kind: 'global-config',
				schema: 1,
				projectConfigDirectory: 'global',
				defaultTaskDirectory: 'tasks',
				currentUserId: 'u1',
				people: [],
				personMetadataFields: [personField],
			},
			taskMetadataSettings: {
				fields: {
					scheduledDate: { enabled: true, icon: 'calendar-range', color: '#0c66e4', required: false, showInTaskView: true, showInProjectCards: true },
					dueDate: { enabled: true, icon: 'calendar-clock', color: '#c9372c', required: false, showInTaskView: true, showInProjectCards: true },
					startDate: { enabled: true, icon: 'plane-takeoff', color: '#227d9b', required: false, showInTaskView: true, showInProjectCards: true },
					doneDate: { enabled: true, icon: 'circle-check', color: '#1f845a', required: false, showInTaskView: true, showInProjectCards: true },
				},
				customFields: [taskField],
			},
		});
		const result = normalizeConfigurationSnapshot(snapshot);
		// same key 'email' — should be deduplicated to one entry
		expect(result.globalConfig.unifiedMetadataFields).toHaveLength(1);
		expect(result.globalConfig.unifiedMetadataFields![0]!.key).toBe('email');
	});

	it('sets migration marker after migration', () => {
		const personField = makePersonMetadataField('email', '邮箱');
		const snapshot = buildSnapshot({
			globalConfig: {
				kind: 'global-config',
				schema: 1,
				projectConfigDirectory: 'global',
				defaultTaskDirectory: 'tasks',
				currentUserId: 'u1',
				people: [],
				personMetadataFields: [personField],
			},
		});
		const result = normalizeConfigurationSnapshot(snapshot);
		expect(result.configurationSchema).toBe(3);
	});
});