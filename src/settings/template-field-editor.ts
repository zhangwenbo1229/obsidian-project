import { Setting } from 'obsidian';
import type { TaskFormField, TaskTypeDefinition } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '../utils/dates';
import { TaskMarkerPickerModal } from '../modals/task-marker-picker-modal';
import {
	normalizeTaskFieldConfig,
	TASK_FORM_FIELDS,
	TASK_FORM_FIELD_LABELS,
} from './task-field-configuration';

const NO_DEFAULT_FIELDS = new Set<TaskFormField>(['relations', 'customFields']);

function stringValue(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export class TemplateFieldEditor {
	constructor(
		private readonly manager: ProjectManager,
		private readonly type: TaskTypeDefinition,
		private readonly rerender: () => void,
	) {}

	mount(container: HTMLElement): void {
		this.type.fieldConfig = normalizeTaskFieldConfig(this.type.fieldConfig);
		for (const field of TASK_FORM_FIELDS) {
			const rule = this.type.fieldConfig[field]!;
			new Setting(container)
				.setName(TASK_FORM_FIELD_LABELS[field])
				.setDesc(rule.enabled ? '该字段会出现在新增和编辑任务中。' : '该字段已在此任务类型中隐藏。')
				.addToggle((toggle) => toggle.setTooltip('显示').setValue(rule.enabled).onChange((enabled) => {
					rule.enabled = enabled;
					this.rerender();
				}))
				.addToggle((toggle) => toggle.setTooltip('必填').setValue(rule.required).onChange((required) => {
					rule.required = required;
				}))
				.addExtraButton((button) => button.setIcon('smile-plus').setTooltip('选择字段图标').onClick(() => {
					new TaskMarkerPickerModal(this.manager.app, rule.icon ?? '', (icon) => {
						rule.icon = icon;
						this.rerender();
					}).open();
				}));
			new Setting(container).setName(`${TASK_FORM_FIELD_LABELS[field]}样式`)
				.setDesc(rule.icon ? `图标：${rule.icon}` : '未设置图标')
				.addColorPicker((picker) => picker.setValue(rule.color ?? '#626f86').onChange((color) => (rule.color = color)))
				.addExtraButton((button) => button.setIcon('rotate-ccw').setTooltip('清除图标和颜色').onClick(() => {
					rule.icon = undefined;
					rule.color = undefined;
					this.rerender();
				}));
			if (rule.enabled && !NO_DEFAULT_FIELDS.has(field)) this.renderDefault(container, field);
		}
	}

	private renderDefault(container: HTMLElement, field: TaskFormField): void {
		const rule = this.type.fieldConfig![field]!;
		const setting = new Setting(container).setName(`${TASK_FORM_FIELD_LABELS[field]}默认值`);
		if (field === 'priority') {
			setting.addDropdown((dropdown) => dropdown
				.addOption('high', '高')
				.addOption('medium', '中')
				.addOption('low', '低')
				.setValue(stringValue(rule.defaultValue) || 'medium')
				.onChange((value) => (rule.defaultValue = value)));
			return;
		}
		if (field === 'reporter' || field === 'assignee') {
			setting.addDropdown((dropdown) => {
				dropdown.addOption('', field === 'reporter' ? '当前用户' : '未分配');
				for (const person of this.manager.globalConfig.people) dropdown.addOption(person.id, person.name);
				dropdown.setValue(stringValue(rule.defaultValue)).onChange((value) => (rule.defaultValue = value || null));
			});
			return;
		}
		if (field === 'startDate' || field === 'dueDate' || field === 'completedAt' || field === 'terminatedAt') {
			setting.addText((text) => {
				text.inputEl.type = 'datetime-local';
				text.setValue(toDateTimeLocalInput(stringValue(rule.defaultValue))).onChange((value) => {
					rule.defaultValue = fromDateTimeLocalInput(value);
				});
			});
			return;
		}
		if (field === 'tags') {
			setting.addText((text) => text
				.setPlaceholder('标签一, 标签二')
				.setValue(Array.isArray(rule.defaultValue) ? rule.defaultValue.join(', ') : '')
				.onChange((value) => (rule.defaultValue = value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean))));
			return;
		}
		setting.addTextArea((area) => {
			area.inputEl.addClass('op-template-field-default');
			area.setValue(field === 'body' ? this.type.template ?? '' : stringValue(rule.defaultValue)).onChange((value) => {
				rule.defaultValue = value;
				if (field === 'body') this.type.template = value;
			});
		});
	}
}
