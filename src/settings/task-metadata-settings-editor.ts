import { Menu, Notice, Setting } from 'obsidian';
import { TaskMarkerPickerModal } from '../modals/task-marker-picker-modal';
import type { ProjectManager } from '../services/project-manager';
import { createUuid } from '../utils/ids';
import {
	normalizeTaskMetadataSettings,
	TASK_METADATA_CUSTOM_FIELD_TYPES,
	TASK_METADATA_FIELDS,
	type TaskMetadataCustomFieldDefinition,
	type TaskMetadataCustomFieldType,
	type TaskMetadataDisplayField,
	type TaskMetadataFieldPresentation,
	type TaskMetadataSettings,
} from './task-metadata-settings';

const LABELS: Record<TaskMetadataDisplayField, string> = {
	scheduledDate: '计划日期', dueDate: '截止日期', startDate: '开始日期', doneDate: '结束日期',
};

const TYPE_LABELS: Record<TaskMetadataCustomFieldType, string> = {
	text: '单行文本',
	'multiline-text': '多行文本',
	number: '数字',
	boolean: '是/否',
	date: '日期',
	'single-select': '单选',
	'multi-select': '多选',
};

function defaultText(value: unknown): string {
	if (Array.isArray(value)) return value
		.map((item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' ? String(item) : '')
		.filter(Boolean)
		.join(', ');
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

export class TaskMetadataSettingsEditor {
	private value: TaskMetadataSettings;
	private root?: HTMLElement;

	constructor(private readonly manager: ProjectManager) {
		this.value = normalizeTaskMetadataSettings(manager.taskMetadataSettings);
	}

	mount(container: HTMLElement): void {
		this.root = container;
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		this.root.empty();
		const disabledFields = TASK_METADATA_FIELDS.filter((field) => !this.value.fields[field].enabled);
		new Setting(this.root)
			.setName('任务元数据字段')
			.setDesc('内置日期与自定义任务元数据在同一列表管理；Markdown 仍保持 tasks 可识别格式。')
			.addButton((button) => button
				.setButtonText('新增任务元数据')
				.setIcon('plus')
				.onClick((event) => {
					const menu = new Menu();
					for (const field of disabledFields) menu.addItem((item) => item
						.setTitle(`添加${LABELS[field]}`)
						.setIcon('plus')
						.onClick(() => {
							this.value.fields[field].enabled = true;
							this.render();
						}));
					if (disabledFields.length > 0) menu.addSeparator();
					menu.addItem((item) => item.setTitle('新增自定义任务元数据').setIcon('list-plus').onClick(() => {
						this.addCustomField();
						this.render();
					}));
					menu.showAtMouseEvent(event);
				}));
		for (const field of TASK_METADATA_FIELDS.filter((item) => this.value.fields[item].enabled)) {
			this.renderBuiltInField(field, this.value.fields[field]);
		}
		for (const field of this.value.customFields) this.renderCustomField(field);
		new Setting(this.root).addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private renderBuiltInField(field: TaskMetadataDisplayField, rule: TaskMetadataFieldPresentation): void {
		const section = this.root!.createDiv({ cls: 'op-task-metadata-setting' });
		new Setting(section).setName(LABELS[field]).setHeading()
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除任务元数据').onClick(() => {
				rule.enabled = false;
				this.render();
			}));
		this.renderPresentation(section, rule);
	}

	private renderPresentation(
		section: HTMLElement,
		rule: Pick<TaskMetadataFieldPresentation, 'icon' | 'color' | 'showInTaskView' | 'showInProjectCards'>,
	): void {
		new Setting(section).setName('样式').setDesc(rule.icon ? `图标：${rule.icon}` : '未设置图标')
			.addButton((button) => button.setButtonText('选择图标').setIcon('smile-plus').onClick(() => {
				new TaskMarkerPickerModal(this.manager.app, rule.icon, (icon) => {
					rule.icon = icon;
					this.render();
				}).open();
			}))
			.addColorPicker((picker) => picker.setValue(rule.color).onChange((color) => (rule.color = color)));
		new Setting(section).setName('任务视图显示').addToggle((toggle) => toggle
			.setValue(rule.showInTaskView).onChange((value) => (rule.showInTaskView = value)));
		new Setting(section).setName('项目卡片显示').addToggle((toggle) => toggle
			.setValue(rule.showInProjectCards).onChange((value) => (rule.showInProjectCards = value)));
	}

	private addCustomField(): void {
		let index = this.value.customFields.length + 1;
		while (this.value.customFields.some((field) => field.key === `task-field-${index}`)) index += 1;
		this.value.customFields.push({
			id: createUuid(), key: `task-field-${index}`, name: `任务元数据 ${index}`, type: 'text',
			required: false, defaultValue: null, icon: 'brackets', color: '#626f86',
			showInTaskView: true, showInProjectCards: true,
		});
	}

	private renderCustomField(field: TaskMetadataCustomFieldDefinition): void {
		const section = this.root!.createDiv({ cls: 'op-task-metadata-setting is-custom' });
		new Setting(section).setName(field.name).setDesc('自定义任务元数据').setHeading()
			.addToggle((toggle) => toggle.setTooltip('必填').setValue(field.required).onChange((required) => (field.required = required)))
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除任务元数据').onClick(() => {
				this.value.customFields = this.value.customFields.filter((item) => item !== field);
				this.render();
			}));
		new Setting(section).setClass('op-template-metadata-row').setName('元数据信息')
			.addText((text) => text.setPlaceholder('字段键').setValue(field.key).onChange((key) => (field.key = key.trim())))
			.addText((text) => text.setPlaceholder('显示名称').setValue(field.name).onChange((name) => (field.name = name)))
			.addDropdown((dropdown) => {
				for (const type of TASK_METADATA_CUSTOM_FIELD_TYPES) dropdown.addOption(type, TYPE_LABELS[type]);
				dropdown.setValue(field.type).onChange((type) => {
					field.type = type as TaskMetadataCustomFieldType;
					this.render();
				});
			});
		const defaultSetting = new Setting(section).setName('默认值');
		if (field.type === 'boolean') {
			defaultSetting.addToggle((toggle) => toggle.setValue(field.defaultValue === true).onChange((value) => (field.defaultValue = value)));
		} else {
			defaultSetting.addText((text) => text.setValue(defaultText(field.defaultValue)).onChange((value) => {
				field.defaultValue = field.type === 'number'
					? value ? Number(value) : null
					: field.type === 'multi-select'
						? value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean)
						: value || null;
			}));
		}
		if (field.type === 'single-select' || field.type === 'multi-select') this.renderOptions(section, field);
		this.renderPresentation(section, field);
	}

	private renderOptions(section: HTMLElement, field: TaskMetadataCustomFieldDefinition): void {
		for (const option of field.options ?? []) {
			new Setting(section).setClass('op-template-option-row').setName('选项')
				.addText((text) => text.setPlaceholder('选项 ID').setValue(option.id).onChange((id) => (option.id = id.trim())))
				.addText((text) => text.setPlaceholder('显示名称').setValue(option.name).onChange((name) => (option.name = name)))
				.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除选项').onClick(() => {
					field.options = field.options?.filter((item) => item !== option);
					this.render();
				}));
		}
		new Setting(section).addButton((button) => button.setButtonText('新增选项').setIcon('plus').onClick(() => {
			const index = (field.options?.length ?? 0) + 1;
			field.options = [...(field.options ?? []), { id: `option-${index}`, name: `选项 ${index}` }];
			this.render();
		}));
	}

	private async save(): Promise<void> {
		try {
			this.value = normalizeTaskMetadataSettings(this.value);
			await this.manager.saveTaskMetadataSettings(this.value);
			new Notice('任务元数据配置已保存。');
		} catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}
}
