import { Setting } from 'obsidian';
import type { ProjectConfig, TaskFormField, TaskTypeDefinition } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '../utils/dates';
import { taskFieldEnabled, taskFieldRule } from '../settings/task-field-configuration';
import { applyFieldPresentation } from '../views/field-presentation';
import { renderGroupedTagPicker } from './grouped-tag-picker';

export function fieldSetting(container: HTMLElement, name: string, type: TaskTypeDefinition | undefined, field: TaskFormField): Setting {
	const setting = new Setting(container).setName(name);
	applyFieldPresentation(setting, taskFieldRule(type, field));
	return setting;
}

export function displayValue(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export interface DateFieldsValue {
	scheduledDate: string | null;
	startDate: string | null;
	dueDate: string | null;
	endDate: string | null;
}

export function renderDateFields(
	container: HTMLElement,
	taskType: TaskTypeDefinition | undefined,
	dates: DateFieldsValue,
	onChange: (field: keyof DateFieldsValue, value: string | null) => void,
): void {
	if (taskFieldEnabled(taskType, 'scheduledDate')) fieldSetting(container, '计划日期', taskType, 'scheduledDate').addText((text) => {
		text.inputEl.type = 'datetime-local';
		text.setValue(toDateTimeLocalInput(dates.scheduledDate)).onChange((v) => onChange('scheduledDate', fromDateTimeLocalInput(v)));
	});
	if (taskFieldEnabled(taskType, 'dueDate')) fieldSetting(container, '截止日期', taskType, 'dueDate').addText((text) => {
		text.inputEl.type = 'datetime-local';
		text.setValue(toDateTimeLocalInput(dates.dueDate)).onChange((v) => onChange('dueDate', fromDateTimeLocalInput(v)));
	});
	if (taskFieldEnabled(taskType, 'startDate')) fieldSetting(container, '开始日期', taskType, 'startDate').addText((text) => {
		text.inputEl.type = 'datetime-local';
		text.setValue(toDateTimeLocalInput(dates.startDate)).onChange((v) => onChange('startDate', fromDateTimeLocalInput(v)));
	});
	if (taskFieldEnabled(taskType, 'endDate')) fieldSetting(container, '结束日期', taskType, 'endDate').addText((text) => {
		text.inputEl.type = 'datetime-local';
		text.setValue(toDateTimeLocalInput(dates.endDate)).onChange((v) => onChange('endDate', fromDateTimeLocalInput(v)));
	});
}

export function renderReporterField(
	container: HTMLElement,
	taskType: TaskTypeDefinition | undefined,
	people: { id: string; name: string; active: boolean }[],
	value: string,
	onChange: (value: string) => void,
): void {
	if (!taskFieldEnabled(taskType, 'reporter')) return;
	fieldSetting(container, '提报人', taskType, 'reporter').addDropdown((dropdown) => {
		for (const person of people.filter((p) => p.active)) dropdown.addOption(person.id, person.name);
		dropdown.setValue(value).onChange(onChange);
	});
}

export function renderAssigneeField(
	container: HTMLElement,
	taskType: TaskTypeDefinition | undefined,
	people: { id: string; name: string }[],
	value: string | null,
	onChange: (value: string | null) => void,
): void {
	if (!taskFieldEnabled(taskType, 'assignee')) return;
	fieldSetting(container, '经办人', taskType, 'assignee').addDropdown((dropdown) => {
		dropdown.addOption('', '未分配');
		for (const person of people) dropdown.addOption(person.id, person.name);
		dropdown.setValue(value ?? '').onChange((v) => onChange(v || null));
	});
}

export function renderTagsField(
	container: HTMLElement,
	taskType: TaskTypeDefinition | undefined,
	manager: ProjectManager,
	tags: string[],
	onChange: (tags: string[]) => void,
): void {
	if (taskFieldEnabled(taskType, 'tags')) {
		renderGroupedTagPicker(container, manager, tags, onChange, taskFieldRule(taskType, 'tags'));
	}
}

export function renderCustomFields(
	container: HTMLElement,
	project: ProjectConfig | undefined,
	taskTypeId: string,
	custom: Record<string, unknown>,
	manager: ProjectManager,
	onChange: (key: string, value: unknown) => void,
): void {
	for (const field of project?.customFields.filter((f) => f.active && (!f.taskTypeIds || f.taskTypeIds.includes(taskTypeId))) ?? []) {
		const setting = new Setting(container).setName(field.name);
		applyFieldPresentation(setting, field);
		const current = custom[field.key] ?? field.default;
		if (field.type === 'boolean') {
			setting.addToggle((t) => t.setValue(Boolean(current)).onChange((v) => onChange(field.key, v)));
		} else if (field.type === 'single-select') {
			setting.addDropdown((dd) => {
				for (const o of field.options ?? []) dd.addOption(o.id, o.name);
				dd.setValue(displayValue(current)).onChange((v) => onChange(field.key, v));
			});
		} else if (field.type === 'multi-select') {
			setting.addText((t) => t.setPlaceholder('使用逗号分隔选项 ID')
				.setValue(Array.isArray(current) ? (current as unknown[]).join(',') : '')
				.onChange((v) => onChange(field.key, v.split(/[,，]/u).map((s) => s.trim()).filter(Boolean))));
		} else if (field.type === 'user') {
			setting.addDropdown((dd) => {
				dd.addOption('', '未选择');
				for (const p of manager.globalConfig.people) dd.addOption(p.id, p.name);
				dd.setValue(displayValue(current)).onChange((v) => onChange(field.key, v || null));
			});
		} else if (field.type === 'task-reference') {
			setting.addDropdown((dd) => {
				dd.addOption('', '未选择');
				for (const t of manager.index.validTasks()) dd.addOption(t.document.metadata.uid, `${t.document.metadata.key} · ${t.document.metadata.title}`);
				dd.setValue(displayValue(current)).onChange((v) => onChange(field.key, v || null));
			});
		} else if (field.type === 'date') {
			setting.addText((t) => {
				t.inputEl.type = 'date';
				t.setValue(displayValue(current)).onChange((v) => onChange(field.key, v || null));
			});
		} else if (field.type === 'datetime') {
			setting.addText((t) => {
				t.inputEl.type = 'datetime-local';
				t.setValue(toDateTimeLocalInput(displayValue(current))).onChange((v) => onChange(field.key, fromDateTimeLocalInput(v)));
			});
		} else if (field.type === 'multiline-text') {
			setting.addTextArea((a) => a.setValue(displayValue(current)).onChange((v) => onChange(field.key, v)));
		} else {
			setting.addText((t) => t.setValue(displayValue(current)).onChange((v) => {
				onChange(field.key, field.type === 'number' ? Number(v) : v);
			}));
		}
	}
}