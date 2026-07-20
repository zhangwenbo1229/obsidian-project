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
	skipFields?: Set<string>,
): void {
	if (taskFieldEnabled(taskType, 'scheduledDate') && !skipFields?.has('scheduledDate')) fieldSetting(container, '计划日期', taskType, 'scheduledDate').addText((text) => {
		text.inputEl.type = 'datetime-local';
		text.setValue(toDateTimeLocalInput(dates.scheduledDate)).onChange((v) => onChange('scheduledDate', fromDateTimeLocalInput(v)));
	});
	if (taskFieldEnabled(taskType, 'dueDate') && !skipFields?.has('dueDate')) fieldSetting(container, '截止日期', taskType, 'dueDate').addText((text) => {
		text.inputEl.type = 'datetime-local';
		text.setValue(toDateTimeLocalInput(dates.dueDate)).onChange((v) => onChange('dueDate', fromDateTimeLocalInput(v)));
	});
	if (taskFieldEnabled(taskType, 'startDate') && !skipFields?.has('startDate')) fieldSetting(container, '开始日期', taskType, 'startDate').addText((text) => {
		text.inputEl.type = 'datetime-local';
		text.setValue(toDateTimeLocalInput(dates.startDate)).onChange((v) => onChange('startDate', fromDateTimeLocalInput(v)));
	});
	if (taskFieldEnabled(taskType, 'endDate') && !skipFields?.has('endDate')) fieldSetting(container, '结束日期', taskType, 'endDate').addText((text) => {
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
	skipFields?: Set<string>,
): void {
	if (taskFieldEnabled(taskType, 'tags') && !skipFields?.has('tags')) {
		renderGroupedTagPicker(container, manager, tags, onChange, taskFieldRule(taskType, 'tags'), true);
	}
}

interface RenderedCustomField {
	key: string;
	name: string;
	type: string;
	default: unknown;
	options?: { id: string; name: string }[];
	icon?: string;
	color?: string;
	required?: boolean;
}

export function renderSingleCustomField(
	container: HTMLElement,
	field: RenderedCustomField,
	current: unknown,
	manager: ProjectManager,
	onChange: (key: string, value: unknown) => void,
): void {
	const setting = new Setting(container).setName(field.name);
	applyFieldPresentation(setting, field);
	if (field.type === 'boolean') {
		setting.addToggle((t) => t.setValue(Boolean(current)).onChange((v) => onChange(field.key, v)));
	} else if (field.type === 'single-select') {
		setting.addDropdown((dd) => {
			for (const o of field.options ?? []) dd.addOption(o.id, o.name);
			dd.setValue(displayValue(current)).onChange((v) => onChange(field.key, v));
		});
	} else if (field.type === 'multi-select') {
		renderGroupedTagPicker(
			setting.controlEl,
			manager,
			Array.isArray(current) ? (current as string[]) : [],
			(tags) => onChange(field.key, tags),
			field,
			true,
		);
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

export function renderCustomFields(
	container: HTMLElement,
	project: ProjectConfig | undefined,
	taskTypeId: string,
	custom: Record<string, unknown>,
	manager: ProjectManager,
	onChange: (key: string, value: unknown) => void,
	effectiveRefs?: { unifiedMetadataFieldId: string; taskTypeIds?: string[] }[],
): void {
	const fieldsEl = container.createDiv({ cls: 'op-task-custom-fields' });
	let renderedCount = 0;
	const renderedKeys = new Set<string>();
	const renderedNames = new Set<string>();

	// 预扫描新版字段（Loop 2 + Loop 3），收集 key 和 name，用于让 Loop 1 跳过旧版重复字段
	const pool = manager.globalConfig.unifiedMetadataFields ?? [];
	const unifiedById = new Map(pool.map((f) => [f.id, f]));
	const projectRefs = effectiveRefs ?? project?.customFieldRefs ?? [];
	const taskMetaRefs = manager.taskMetadataSettings.customFieldRefs ?? [];
	const loop23Keys = new Set<string>();
	const loop23Names = new Set<string>();
	for (const ref of projectRefs) {
		const unified = unifiedById.get(ref.unifiedMetadataFieldId);
		if (!unified) continue;
		const refTaskTypeIds = ref.taskTypeIds ?? [];
		if (refTaskTypeIds.length > 0 && !refTaskTypeIds.includes(taskTypeId)) continue;
		loop23Keys.add(unified.key);
		loop23Names.add(unified.name);
	}
	for (const ref of taskMetaRefs) {
		const unified = unifiedById.get(ref.unifiedMetadataFieldId);
		if (!unified) continue;
		loop23Keys.add(unified.key);
		loop23Names.add(unified.name);
	}

	// Loop 1: 旧版 customFields（跳过与新版同 key 或同 name 的字段，避免重复渲染）
	for (const field of (project?.customFields ?? []).filter((f) => f.active && (!f.taskTypeIds || f.taskTypeIds.includes(taskTypeId))) ?? []) {
		if (loop23Keys.has(field.key) || loop23Names.has(field.name)) continue;
		if (renderedKeys.has(field.key) || renderedNames.has(field.name)) continue;
		renderSingleCustomField(fieldsEl, field, custom[field.key] ?? field.default, manager, onChange);
		renderedKeys.add(field.key);
		renderedNames.add(field.name);
		renderedCount++;
	}
	// Loop 2: 新版 customFieldRefs + 统一元数据字段池
	for (const ref of projectRefs) {
		const refTaskTypeIds = ref.taskTypeIds ?? [];
		if (refTaskTypeIds.length > 0 && !refTaskTypeIds.includes(taskTypeId)) continue;
		const unified = unifiedById.get(ref.unifiedMetadataFieldId);
		if (!unified || renderedKeys.has(unified.key)) continue;
		// 内置字段由 task-modal-base 内置区渲染，跳过避免重复
		if (unified.isBuiltIn) continue;
		renderSingleCustomField(
			fieldsEl,
			{
				key: unified.key,
				name: unified.name,
				type: unified.type,
				default: unified.defaultValue,
				options: unified.options,
				icon: unified.icon,
				color: unified.color,
				required: unified.required,
			},
			custom[unified.key] ?? unified.defaultValue,
			manager,
			onChange,
		);
		renderedKeys.add(unified.key);
		renderedNames.add(unified.name);
		renderedCount++;
	}
	// Loop 3: 任务元数据 customFieldRefs（全局任务元数据，新增任务弹窗也需输入）
	for (const ref of taskMetaRefs) {
		const unified = unifiedById.get(ref.unifiedMetadataFieldId);
		if (!unified || renderedKeys.has(unified.key)) continue;
		// 内置字段由 task-modal-base 内置区渲染，跳过避免重复
		if (unified.isBuiltIn) continue;
		renderSingleCustomField(
			fieldsEl,
			{
				key: unified.key,
				name: unified.name,
				type: unified.type,
				default: unified.defaultValue,
				options: unified.options,
				icon: unified.icon,
				color: unified.color,
				required: unified.required,
			},
			custom[unified.key] ?? unified.defaultValue,
			manager,
			onChange,
		);
		renderedKeys.add(unified.key);
		renderedNames.add(unified.name);
		renderedCount++;
	}

	if (renderedCount === 0) {
		fieldsEl.remove();
	}
}