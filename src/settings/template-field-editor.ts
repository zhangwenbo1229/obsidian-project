import { Menu, Setting } from 'obsidian';
import type {
	CustomFieldDefinition,
	CustomFieldType,
	TaskConfigurationTemplate,
	TaskFormField,
	TaskTypeDefinition,
} from '../domain/types';
import { TaskMarkerPickerModal } from '../modals/task-marker-picker-modal';
import type { ProjectManager } from '../services/project-manager';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '../utils/dates';
import { createUuid } from '../utils/ids';
import {
	normalizeTaskFieldConfig,
	taskFieldOptions,
	TASK_FORM_FIELDS,
	TASK_FORM_FIELD_LABELS,
} from './task-field-configuration';

const NO_DEFAULT_FIELDS = new Set<TaskFormField>(['relations', 'customFields']);
const PROJECT_METADATA_FIELDS = TASK_FORM_FIELDS.filter((field) => field !== 'customFields');

const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
	text: '单行文本',
	'multiline-text': '多行文本',
	number: '数字',
	boolean: '是/否',
	date: '日期',
	datetime: '日期时间',
	'single-select': '单选',
	'multi-select': '多选',
	user: '用户',
	'task-reference': '项目引用',
};

const CUSTOM_FIELD_TYPES = Object.keys(CUSTOM_FIELD_TYPE_LABELS) as CustomFieldType[];

function stringValue(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function customDefaultText(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map((item) => typeof item === 'string' || typeof item === 'number' ? String(item) : '').filter(Boolean).join(', ');
	}
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

export class TemplateFieldEditor {
	constructor(
		private readonly manager: ProjectManager,
		private readonly template: TaskConfigurationTemplate,
		private readonly rerender: () => void,
	) {}

	private get type(): TaskTypeDefinition {
		return this.template.taskTypes[0]!;
	}

	mount(container: HTMLElement): void {
		this.type.fieldConfig = normalizeTaskFieldConfig(this.type.fieldConfig);
		const disabledFields = PROJECT_METADATA_FIELDS.filter((field) => !this.type.fieldConfig?.[field]?.enabled);
		new Setting(container)
			.setName('项目元数据字段')
			.setDesc('内置与自定义元数据在同一列表管理，并自动同步到新增、编辑项目弹窗。')
			.addButton((button) => button.setButtonText('新增项目元数据').setIcon('plus').onClick((event) => {
				const menu = new Menu();
				for (const field of disabledFields) menu.addItem((item) => item
					.setTitle(`添加${TASK_FORM_FIELD_LABELS[field]}`)
					.setIcon('plus')
					.onClick(() => {
						this.type.fieldConfig![field]!.enabled = true;
						this.rerender();
					}));
				if (disabledFields.length > 0) menu.addSeparator();
				menu.addItem((item) => item.setTitle('新增自定义元数据').setIcon('list-plus').onClick(() => {
					this.addCustomField();
					this.rerender();
				}));
				menu.showAtMouseEvent(event);
			}));

		for (const field of PROJECT_METADATA_FIELDS.filter((item) => this.type.fieldConfig?.[item]?.enabled)) {
			this.renderBuiltInField(container, field);
		}
		for (const field of this.template.customFields) this.renderCustomField(container, field);
	}

	private renderBuiltInField(container: HTMLElement, field: TaskFormField): void {
		const rule = this.type.fieldConfig![field]!;
		const fieldContainer = container.createDiv({ cls: 'op-template-field-setting' });
		new Setting(fieldContainer)
			.setName(TASK_FORM_FIELD_LABELS[field])
			.setDesc('该元数据会出现在新增和编辑项目中。')
			.addToggle((toggle) => toggle.setTooltip('必填').setValue(rule.required).onChange((required) => {
				rule.required = required;
			}))
			.addExtraButton((button) => button.setIcon('smile-plus').setTooltip('选择字段图标').onClick(() => {
				new TaskMarkerPickerModal(this.manager.app, rule.icon ?? '', (icon) => {
					rule.icon = icon;
					this.rerender();
				}).open();
			}))
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除项目元数据').onClick(() => {
				rule.enabled = false;
				this.rerender();
			}));
		new Setting(fieldContainer).setName(`${TASK_FORM_FIELD_LABELS[field]}样式`)
			.setDesc(rule.icon ? `图标：${rule.icon}` : '未设置图标')
			.addColorPicker((picker) => picker.setValue(rule.color ?? '#626f86').onChange((color) => (rule.color = color)))
			.addExtraButton((button) => button.setIcon('rotate-ccw').setTooltip('清除图标和颜色').onClick(() => {
				rule.icon = undefined;
				rule.color = undefined;
				this.rerender();
			}));
		if (field === 'priority') this.renderPriorityOptions(fieldContainer);
		if (!NO_DEFAULT_FIELDS.has(field)) this.renderDefault(fieldContainer, field);
	}

	private renderPriorityOptions(container: HTMLElement): void {
		const rule = this.type.fieldConfig!.priority!;
		const options = rule.options ?? taskFieldOptions(this.type, 'priority');
		rule.options = options;
		new Setting(container).setName('优先级选项').setDesc('选项 ID 写入项目元数据，名称用于界面显示。');
		for (const option of options) {
			new Setting(container)
				.setClass('op-template-option-row')
				.setName(option.name)
				.addText((text) => text.setPlaceholder('选项 ID').setValue(option.id).onChange((id) => {
					const previous = option.id;
					option.id = id.trim();
					if (rule.defaultValue === previous) rule.defaultValue = option.id;
				}))
				.addText((text) => text.setPlaceholder('显示名称').setValue(option.name).onChange((name) => (option.name = name)))
				.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除优先级选项').setDisabled(options.length <= 1).onClick(() => {
					rule.options = options.filter((item) => item !== option);
					if (rule.defaultValue === option.id) rule.defaultValue = rule.options[0]?.id ?? 'medium';
					this.rerender();
				}));
		}
		new Setting(container).addButton((button) => button.setButtonText('新增优先级选项').setIcon('plus').onClick(() => {
			const index = options.length + 1;
			rule.options = [...options, { id: `priority-${index}`, name: `优先级 ${index}` }];
			this.rerender();
		}));
	}

	private renderDefault(container: HTMLElement, field: TaskFormField): void {
		const rule = this.type.fieldConfig![field]!;
		const setting = new Setting(container).setName(`${TASK_FORM_FIELD_LABELS[field]}默认值`);
		if (field === 'priority') {
			setting.addDropdown((dropdown) => {
				for (const option of taskFieldOptions(this.type, field)) dropdown.addOption(option.id, option.name);
				dropdown.setValue(stringValue(rule.defaultValue)).onChange((value) => (rule.defaultValue = value));
			});
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
		if (field === 'scheduledDate' || field === 'startDate' || field === 'dueDate' || field === 'endDate') {
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

	private addCustomField(): void {
		const index = this.template.customFields.length + 1;
		this.template.customFields.push({
			id: createUuid(), key: `field-${index}`, name: `字段 ${index}`, type: 'text',
			required: false, active: true, default: null,
		});
	}

	private renderCustomField(container: HTMLElement, field: CustomFieldDefinition): void {
		const fieldContainer = container.createDiv({ cls: 'op-template-field-setting is-custom' });
		new Setting(fieldContainer)
			.setName(field.name)
			.setDesc('自定义项目元数据')
			.addToggle((toggle) => toggle.setTooltip('启用').setValue(field.active).onChange((value) => (field.active = value)))
			.addToggle((toggle) => toggle.setTooltip('必填').setValue(field.required).onChange((value) => (field.required = value)))
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除项目元数据').onClick(() => {
				this.template.customFields = this.template.customFields.filter((item) => item !== field);
				this.rerender();
			}));
		new Setting(fieldContainer)
			.setClass('op-template-metadata-row')
			.setName('元数据信息')
			.addText((text) => text.setPlaceholder('字段键').setValue(field.key).onChange((value) => (field.key = value.trim())))
			.addText((text) => text.setPlaceholder('显示名称').setValue(field.name).onChange((value) => (field.name = value)))
			.addDropdown((dropdown) => {
				for (const type of CUSTOM_FIELD_TYPES) dropdown.addOption(type, CUSTOM_FIELD_TYPE_LABELS[type]);
				dropdown.setValue(field.type).onChange((value) => {
					field.type = value as CustomFieldType;
					this.rerender();
				});
			});
		new Setting(fieldContainer).setName(`${field.name}样式`)
			.setDesc(field.icon ? `图标：${field.icon}` : '未设置图标')
			.addButton((button) => button.setButtonText('选择图标').onClick(() => {
				new TaskMarkerPickerModal(this.manager.app, field.icon ?? '', (icon) => {
					field.icon = icon;
					this.rerender();
				}).open();
			}))
			.addColorPicker((picker) => picker.setValue(field.color ?? '#626f86').onChange((color) => (field.color = color)))
			.addExtraButton((button) => button.setIcon('rotate-ccw').setTooltip('清除样式').onClick(() => {
				field.icon = undefined;
				field.color = undefined;
				this.rerender();
			}));
		const fieldOptions = new Setting(fieldContainer).setName(`${field.name}配置`);
		if (field.type === 'boolean') {
			fieldOptions.addToggle((toggle) => toggle.setTooltip('默认值').setValue(Boolean(field.default)).onChange((value) => (field.default = value)));
		} else {
			fieldOptions.addText((text) => text.setPlaceholder('默认值').setValue(customDefaultText(field.default)).onChange((value) => {
				field.default = field.type === 'number'
					? value ? Number(value) : null
					: field.type === 'multi-select'
						? value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean)
						: value || null;
			}));
		}
		if (field.type === 'single-select' || field.type === 'multi-select') this.renderCustomFieldOptions(fieldContainer, field);
	}

	private renderCustomFieldOptions(container: HTMLElement, field: CustomFieldDefinition): void {
		for (const option of field.options ?? []) {
			new Setting(container).setClass('op-template-option-row').setName('选项')
				.addText((text) => text.setPlaceholder('选项 ID').setValue(option.id).onChange((id) => (option.id = id.trim())))
				.addText((text) => text.setPlaceholder('显示名称').setValue(option.name).onChange((name) => (option.name = name)))
				.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除选项').onClick(() => {
					field.options = field.options?.filter((item) => item !== option);
					this.rerender();
				}));
		}
		new Setting(container).addButton((button) => button.setButtonText('新增选项').setIcon('plus').onClick(() => {
			const index = (field.options?.length ?? 0) + 1;
			field.options = [...(field.options ?? []), { id: `option-${index}`, name: `选项 ${index}` }];
			this.rerender();
		}));
	}
}
