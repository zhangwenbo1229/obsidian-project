import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeTaskFieldConfig, taskFieldOptions, TASK_FORM_FIELDS } from '../../src/settings/task-field-configuration';

const modelUrl = new URL('../../src/settings/task-field-configuration.ts', import.meta.url);
const editorUrl = new URL('../../src/settings/template-field-editor.ts', import.meta.url);
const templateSource = readFileSync(new URL('../../src/settings/template-editor.ts', import.meta.url), 'utf8');

describe('task template field configuration', () => {
	it('normalizes every user-editable field for legacy task types', () => {
		expect(existsSync(modelUrl)).toBe(true);
		expect(TASK_FORM_FIELDS).toEqual([
			'title', 'priority', 'reporter', 'assignee', 'scheduledDate', 'dueDate', 'startDate', 'endDate', 'tags',
			'body', 'links', 'subtasks', 'relations', 'notes', 'customFields',
		]);
		expect(TASK_FORM_FIELDS).not.toContain('completedAt');
		expect(TASK_FORM_FIELDS).not.toContain('terminatedAt');
		const normalized = normalizeTaskFieldConfig();
		for (const field of TASK_FORM_FIELDS) expect(normalized[field]).toMatchObject({ enabled: true, required: false });
		const styled = normalizeTaskFieldConfig({ title: {
			enabled: true, required: true, icon: ' heading ', color: '#Ab12Cd',
		} });
		expect(styled.title).toMatchObject({ icon: 'heading', color: '#ab12cd' });
		expect(normalizeTaskFieldConfig({ title: {
			enabled: true, required: false, icon: ' ', color: 'red',
		} }).title).toMatchObject({ icon: undefined, color: undefined });
		const priorityType = { id: 'bug', name: 'Bug', icon: 'bug', color: '#ff0000', active: true, template: '', fieldConfig: normalizeTaskFieldConfig({
			priority: { enabled: true, required: false, defaultValue: 'critical', options: [{ id: 'critical', name: '紧急' }, { id: 'routine', name: '常规' }] },
		}) };
		expect(taskFieldOptions(priorityType, 'priority')).toEqual([{ id: 'critical', name: '紧急' }, { id: 'routine', name: '常规' }]);
	});

	it('provides a dedicated editor and mounts it from task templates', () => {
		expect(existsSync(editorUrl)).toBe(true);
		expect(templateSource).toContain('TemplateFieldEditor');
		expect(templateSource).toContain('fieldConfig');
		expect(templateSource).not.toContain("setName('自定义字段')");
		expect(templateSource).not.toContain("setButtonText('新增自定义字段')");
		const editorSource = readFileSync(editorUrl, 'utf8');
		const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
		expect(editorSource).toContain("setButtonText('新增项目元数据')");
		expect(editorSource).toContain("setTooltip('删除项目元数据')");
		expect(editorSource).toContain('op-template-field-setting');
		expect(editorSource).toContain("setTitle('新增自定义元数据')");
		expect(editorSource).toContain('template.customFields');
		expect(editorSource).toContain("setName('优先级选项')");
		expect(editorSource).toContain("setClass('op-template-option-row')");
		expect(editorSource).toContain("setClass('op-template-metadata-row')");
		expect(css).toMatch(/\.op-template-(?:option|metadata)-row[^}]*\.setting-item-control[^}]*min-width:\s*0/u);
		expect(css).toMatch(/\.op-template-(?:option|metadata)-row[^}]*input\[type=['"]text['"]\][^}]*max-width:/u);
	});
});
