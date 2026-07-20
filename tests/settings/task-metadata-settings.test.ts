import { describe, expect, it } from 'vitest';
import { normalizeTaskMetadataSettings, TASK_METADATA_FIELDS } from '../../src/settings/task-metadata-settings';
import { normalizeConfigurationSnapshot, type ConfigurationSnapshot } from '../../src/settings/configuration-store';
import { readFileSync } from 'node:fs';

const snapshot: ConfigurationSnapshot = {
	globalConfig: { kind: 'global-config', schema: 1, projectConfigDirectory: 'projects', defaultTaskDirectory: 'projects', currentUserId: 'user', people: [], personMetadataFields: [] },
	projects: [], tagOrder: [],
};

describe('task metadata settings', () => {
	it('only exposes the four supported task dates', () => {
		const settings = normalizeTaskMetadataSettings();
		expect(TASK_METADATA_FIELDS).toEqual(['scheduledDate', 'dueDate', 'startDate', 'doneDate']);
		expect(Object.keys(settings.fields)).toEqual(['scheduledDate', 'dueDate', 'startDate', 'doneDate']);
		expect(settings.fields.dueDate).toMatchObject({ icon: 'calendar-clock', color: '#c9372c', showInTaskView: true, showInProjectCards: true });
		expect(settings.fields.dueDate.enabled).toBe(true);
	});

	it('rejects invalid colors and preserves explicit visibility choices', () => {
		const settings = normalizeTaskMetadataSettings({ fields: { dueDate: { icon: ' clock ', color: 'red', showInTaskView: false, showInProjectCards: false } } });
		expect(settings.fields.dueDate).toMatchObject({ icon: 'clock', color: '#c9372c', showInTaskView: false, showInProjectCards: false });
	});

	it('persists removal and exposes controls to restore task metadata fields', () => {
		const settings = normalizeTaskMetadataSettings({ fields: { dueDate: { enabled: false } } });
		expect(settings.fields.dueDate.enabled).toBe(false);
		const editor = readFileSync(new URL('../../src/settings/task-metadata-settings-editor.ts', import.meta.url), 'utf8');
		expect(editor).toContain("setButtonText('新增任务元数据')");
		expect(editor).toContain("setTooltip('删除任务元数据')");
		expect(editor).toContain('new Menu()');
		expect(editor).toContain("setTitle('新增自定义任务元数据（旧版）')");
		expect(editor).not.toContain('setDisabled(!selectedField)');
	});

	it('normalizes user-defined task metadata and rejects duplicate or invalid keys', () => {
		const settings = normalizeTaskMetadataSettings({
			customFields: [
				{ id: 'severity', key: 'severity', name: '严重程度', type: 'single-select', icon: 'alert-triangle', color: '#ff0000', showInTaskView: false, showInProjectCards: true, options: [{ id: 'critical', name: '紧急' }] },
				{ id: 'duplicate', key: 'severity', name: '重复', type: 'text' },
				{ id: 'invalid', key: 'bad key', name: '无效', type: 'text' },
			],
		});
		expect(settings.customFields).toEqual([expect.objectContaining({
			id: 'severity', key: 'severity', name: '严重程度', type: 'single-select', icon: 'alert-triangle',
			color: '#ff0000', showInTaskView: false, showInProjectCards: true,
			options: [{ id: 'critical', name: '紧急' }],
		})]);
	});

	it('migrates settings into the configuration snapshot', () => {
		expect(normalizeConfigurationSnapshot(snapshot).taskMetadataSettings).toEqual(normalizeTaskMetadataSettings());
	});
});
