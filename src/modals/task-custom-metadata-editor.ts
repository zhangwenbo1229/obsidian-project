import { Setting } from 'obsidian';
import type {
	TaskMetadataCustomFieldDefinition,
	TaskMetadataSettings,
} from '../settings/task-metadata-settings';

function cloneValue<T>(value: T): T {
	return value === undefined ? value : structuredClone(value);
}

export function taskCustomMetadataDefaults(
	settings: TaskMetadataSettings,
	existing: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
	const values = structuredClone(existing) as Record<string, unknown>;
	for (const field of settings.customFields) {
		if (values[field.key] === undefined && field.defaultValue !== null && field.defaultValue !== undefined) {
			values[field.key] = cloneValue(field.defaultValue);
		}
	}
	return values;
}

export function validateTaskCustomMetadata(
	settings: TaskMetadataSettings,
	values: Readonly<Record<string, unknown>>,
): void {
	for (const field of settings.customFields) {
		if (!field.required) continue;
		const value = values[field.key];
		if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
			throw new Error(`${field.name}不能为空。`);
		}
	}
}

function updateValue(values: Record<string, unknown>, field: TaskMetadataCustomFieldDefinition, value: unknown): void {
	if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) delete values[field.key];
	else values[field.key] = value;
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
			updateValue(values, field, [...selected]);
		});
		label.createSpan({ text: option.name });
	}
}

export function renderTaskCustomMetadataFields(
	container: HTMLElement,
	settings: TaskMetadataSettings,
	values: Record<string, unknown>,
): void {
	for (const field of settings.customFields) {
		const setting = new Setting(container).setName(field.name).setDesc(`任务元数据 · ${field.key}`);
		const current = values[field.key];
		if (field.type === 'boolean') {
			setting.addToggle((toggle) => toggle.setValue(current === true).onChange((value) => updateValue(values, field, value)));
		} else if (field.type === 'single-select') {
			setting.addDropdown((dropdown) => {
				dropdown.addOption('', '未选择');
				for (const option of field.options ?? []) dropdown.addOption(option.id, option.name);
				dropdown.setValue(textValue(current)).onChange((value) => updateValue(values, field, value));
			});
		} else if (field.type === 'multi-select') {
			renderMultiSelect(setting, field, values);
		} else if (field.type === 'multiline-text') {
			setting.addTextArea((area) => area.setValue(textValue(current)).onChange((value) => updateValue(values, field, value)));
		} else {
			setting.addText((text) => {
				if (field.type === 'number') text.inputEl.type = 'number';
				if (field.type === 'date') text.inputEl.type = 'date';
				text.setValue(textValue(current)).onChange((value) => updateValue(
					values,
					field,
					field.type === 'number' ? value && Number.isFinite(Number(value)) ? Number(value) : null : value,
				));
			});
		}
	}
}
