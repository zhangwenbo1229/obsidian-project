import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as presentation from '../../src/views/task-metadata-presentation';
import type { TaskMetadataCustomFieldDefinition } from '../../src/settings/task-metadata-settings';

const selectField: TaskMetadataCustomFieldDefinition = {
	id: 'severity', key: 'severity', name: '严重程度', type: 'single-select', required: false,
	defaultValue: null, icon: 'alert-triangle', color: '#ff0000', showInTaskView: true,
	showInProjectCards: true, options: [{ id: 'critical', name: '紧急' }],
};

describe('custom task metadata presentation and editing', () => {
	it('formats typed values with configured option labels', () => {
		const formatter = (presentation as unknown as {
			formatTaskCustomMetadataValue?: (field: TaskMetadataCustomFieldDefinition, value: unknown) => string;
		}).formatTaskCustomMetadataValue;
		expect(formatter).toBeTypeOf('function');
		if (!formatter) return;
		expect(formatter(selectField, 'critical')).toBe('紧急');
		expect(formatter({ ...selectField, type: 'multi-select' }, ['critical', 'other'])).toBe('紧急、other');
		expect(formatter({ ...selectField, type: 'boolean' }, false)).toBe('否');
		expect(formatter({ ...selectField, type: 'number' }, 8)).toBe('8');
	});

	it('connects custom metadata to create/edit task dialogs and all task data surfaces', () => {
		const modalEditorUrl = new URL('../../src/modals/task-custom-metadata-editor.ts', import.meta.url);
		expect(existsSync(modalEditorUrl)).toBe(true);
		if (!existsSync(modalEditorUrl)) return;
		const createModal = readFileSync(new URL('../../src/modals/create-subtask-modal.ts', import.meta.url), 'utf8');
		const editModal = readFileSync(new URL('../../src/modals/edit-subtask-modal.ts', import.meta.url), 'utf8');
		const modalEditor = readFileSync(modalEditorUrl, 'utf8');
		const taskView = readFileSync(new URL('../../src/views/task-view-model.ts', import.meta.url), 'utf8');
		const todoModel = readFileSync(new URL('../../src/views/dashboard-modules/todo-model.ts', import.meta.url), 'utf8');
		expect(createModal).toContain('renderTaskCustomMetadataFields');
		expect(createModal).toContain('custom: this.custom');
		expect(editModal).toContain('renderTaskCustomMetadataFields');
		expect(modalEditor).toContain('taskCustomMetadataDefaults');
		expect(taskView).toContain('custom: parsed.custom');
		expect(todoModel).toContain('custom');
	});
});
