import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeTaskFieldConfig, TASK_FORM_FIELDS } from '../../src/settings/task-field-configuration';

const modelUrl = new URL('../../src/settings/task-field-configuration.ts', import.meta.url);
const editorUrl = new URL('../../src/settings/template-field-editor.ts', import.meta.url);
const templateSource = readFileSync(new URL('../../src/settings/template-editor.ts', import.meta.url), 'utf8');

describe('task template field configuration', () => {
	it('normalizes every user-editable field for legacy task types', () => {
		expect(existsSync(modelUrl)).toBe(true);
		expect(TASK_FORM_FIELDS).toEqual([
			'title', 'priority', 'reporter', 'assignee', 'startDate', 'dueDate', 'completedAt', 'terminatedAt', 'tags',
			'body', 'links', 'subtasks', 'relations', 'notes', 'customFields',
		]);
		const normalized = normalizeTaskFieldConfig();
		for (const field of TASK_FORM_FIELDS) expect(normalized[field]).toMatchObject({ enabled: true, required: false });
		const styled = normalizeTaskFieldConfig({ title: {
			enabled: true, required: true, icon: ' heading ', color: '#Ab12Cd',
		} });
		expect(styled.title).toMatchObject({ icon: 'heading', color: '#ab12cd' });
		expect(normalizeTaskFieldConfig({ title: {
			enabled: true, required: false, icon: ' ', color: 'red',
		} }).title).toMatchObject({ icon: undefined, color: undefined });
	});

	it('provides a dedicated editor and mounts it from task templates', () => {
		expect(existsSync(editorUrl)).toBe(true);
		expect(templateSource).toContain('TemplateFieldEditor');
		expect(templateSource).toContain('fieldConfig');
		expect(templateSource).toContain('field.options');
		expect(templateSource).toContain('field.default');
		expect(templateSource).toContain('TaskMarkerPickerModal');
		expect(templateSource).toContain('field.color');
		expect(templateSource).toContain('addCustomFieldOption');
	});
});
