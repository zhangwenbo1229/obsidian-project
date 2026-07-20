import { Setting } from 'obsidian';
import type {
	TaskMetadataCustomFieldDefinition,
	TaskMetadataSettings,
} from '../settings/task-metadata-settings';
import type { UnifiedMetadataField } from '../domain/metadata-types';
import type { ProjectManager } from '../services/project-manager';
import { renderSingleCustomField } from './task-form-fields';

function cloneValue<T>(value: T): T {
	return value === undefined ? value : structuredClone(value);
}

export function taskCustomMetadataDefaults(
	settings: TaskMetadataSettings,
	pool: UnifiedMetadataField[],
	existing: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
	const values = structuredClone(existing) as Record<string, unknown>;
	// 旧版字段
	for (const field of settings.customFields) {
		if (values[field.key] === undefined && field.defaultValue !== null && field.defaultValue !== undefined) {
			values[field.key] = cloneValue(field.defaultValue);
		}
	}
	// 新版引用字段（从统一元数据池获取 defaultValue）
	const poolById = new Map(pool.map((f) => [f.id, f]));
	for (const ref of settings.customFieldRefs ?? []) {
		const unified = poolById.get(ref.unifiedMetadataFieldId);
		if (!unified) continue;
		// 内置字段由弹窗内置区域处理，跳过避免冲突
		if (unified.isBuiltIn) continue;
		if (values[unified.key] === undefined && unified.defaultValue !== null && unified.defaultValue !== undefined) {
			values[unified.key] = cloneValue(unified.defaultValue);
		}
	}
	return values;
}

export function validateTaskCustomMetadata(
	settings: TaskMetadataSettings,
	pool: UnifiedMetadataField[],
	values: Readonly<Record<string, unknown>>,
): void {
	const poolById = new Map(pool.map((f) => [f.id, f]));
	const check = (key: string, name: string, required: boolean) => {
		if (!required) return;
		const value = values[key];
		if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
			throw new Error(`${name}不能为空。`);
		}
	};
	for (const field of settings.customFields) check(field.key, field.name, field.required);
	for (const ref of settings.customFieldRefs ?? []) {
		const unified = poolById.get(ref.unifiedMetadataFieldId);
		// 内置字段由弹窗内置区域处理，跳过避免冲突
		if (!unified || unified.isBuiltIn) continue;
		check(unified.key, unified.name, unified.required);
	}
}

function updateValue(values: Record<string, unknown>, key: string, value: unknown): void {
	if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) delete values[key];
	else values[key] = value;
}

function textValue(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function renderMultiSelect(
	setting: Setting,
	field: TaskMetadataCustomFieldDefinition,
	values: Record<string, unknown>,
): void {
	const current = values[field.key];
	const selected = new Set(Array.isArray(current) ? current.map(String) : []);
	const choices = setting.controlEl.createDiv({ cls: 'op-task-custom-metadata-options' });
	for (const option of field.options ?? []) {
		const label = choices.createEl('label');
		const checkbox = label.createEl('input', { attr: { type: 'checkbox' } });
		checkbox.checked = selected.has(option.id);
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) selected.add(option.id);
			else selected.delete(option.id);
			updateValue(values, field.key, [...selected]);
		});
		label.createSpan({ text: option.name });
	}
}

function renderLegacyCustomField(
	container: HTMLElement,
	field: TaskMetadataCustomFieldDefinition,
	values: Record<string, unknown>,
): void {
	const setting = new Setting(container).setName(field.name).setDesc(`任务元数据 · ${field.key}`);
	const current = values[field.key];
	if (field.type === 'boolean') {
		setting.addToggle((toggle) => toggle.setValue(current === true).onChange((value) => updateValue(values, field.key, value)));
	} else if (field.type === 'single-select') {
		setting.addDropdown((dropdown) => {
			dropdown.addOption('', '未选择');
			for (const option of field.options ?? []) dropdown.addOption(option.id, option.name);
			dropdown.setValue(textValue(current)).onChange((value) => updateValue(values, field.key, value));
		});
	} else if (field.type === 'multi-select') {
		renderMultiSelect(setting, field, values);
	} else if (field.type === 'multiline-text') {
		setting.addTextArea((area) => area.setValue(textValue(current)).onChange((value) => updateValue(values, field.key, value)));
	} else {
		setting.addText((text) => {
			if (field.type === 'number') text.inputEl.type = 'number';
			if (field.type === 'date') text.inputEl.type = 'date';
			text.setValue(textValue(current)).onChange((value) => updateValue(
				values,
				field.key,
				field.type === 'number' ? value && Number.isFinite(Number(value)) ? Number(value) : null : value,
			));
		});
	}
}

export function renderTaskCustomMetadataFields(
	container: HTMLElement,
	settings: TaskMetadataSettings,
	pool: UnifiedMetadataField[],
	values: Record<string, unknown>,
	manager: ProjectManager,
): void {
	const poolById = new Map(pool.map((f) => [f.id, f]));
	const renderedKeys = new Set<string>();

	// 新版引用字段优先渲染（从统一元数据池解析）
	for (const ref of settings.customFieldRefs ?? []) {
		const unified = poolById.get(ref.unifiedMetadataFieldId);
		if (!unified || renderedKeys.has(unified.key)) continue;
		// 内置字段由 CreateSubtaskModal/EditSubtaskModal 内置区域渲染，跳过避免重复
		if (unified.isBuiltIn) continue;
		renderedKeys.add(unified.key);
		renderSingleCustomField(container, {
			key: unified.key,
			name: unified.name,
			type: unified.type,
			default: unified.defaultValue,
			options: unified.options,
			icon: unified.icon,
			color: unified.color,
			required: unified.required,
		}, values[unified.key], manager, (key, value) => updateValue(values, key, value));
	}

	// 旧版字段（跳过与新版同 key 的字段，避免重复）
	for (const field of settings.customFields) {
		if (renderedKeys.has(field.key)) continue;
		renderedKeys.add(field.key);
		renderLegacyCustomField(container, field, values);
	}
}
