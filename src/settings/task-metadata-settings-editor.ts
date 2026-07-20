import { Modal, Notice, Setting } from 'obsidian';
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
	type TaskMetadataRef,
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
		new Setting(this.root)
			.setName('任务元数据字段')
			.setDesc('引用统一元数据字段池中的字段，控制任务视图与项目卡片中的显示。')
			.addButton((button) => button
				.setButtonText('添加自定义元数据')
				.setIcon('plus')
				.setCta()
				.onClick(() => {
					this.addCustomFieldRef();
					this.render();
				}));
		for (const field of TASK_METADATA_FIELDS.filter((item) => this.value.fields[item].enabled)) {
			this.renderBuiltInField(field, this.value.fields[field]);
		}
		for (const field of this.value.customFields) this.renderCustomField(field);
		for (const ref of this.value.customFieldRefs ?? []) this.renderCustomFieldRef(ref);
		new Setting(this.root).addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private renderBuiltInField(field: TaskMetadataDisplayField, rule: TaskMetadataFieldPresentation): void {
		const section = this.root!.createDiv({ cls: 'op-task-metadata-setting' });
		new Setting(section).setName(LABELS[field]).setHeading()
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除任务元数据').onClick(() => {
				rule.enabled = false;
				this.render();
			}));
		new Setting(section).setName('字段类型').setDesc('日期').addDropdown((dropdown) => {
			dropdown.addOption('date', '日期');
			dropdown.setValue('date');
			dropdown.setDisabled(true);
		});
		this.renderPresentation(section, rule);
	}

	private renderPresentation(
		section: HTMLElement,
		rule: Pick<TaskMetadataFieldPresentation, 'icon' | 'color' | 'required' | 'showInTaskView' | 'showInProjectCards'>,
	): void {
		new Setting(section).setName('样式').setDesc(rule.icon ? `图标：${rule.icon}` : '未设置图标')
			.addButton((button) => button.setButtonText('选择图标').setIcon('smile-plus').onClick(() => {
				new TaskMarkerPickerModal(this.manager.app, rule.icon, (icon) => {
					rule.icon = icon;
					this.render();
				}).open();
			}))
			.addColorPicker((picker) => picker.setValue(rule.color).onChange((color) => (rule.color = color)));
		new Setting(section).setName('必填').addToggle((toggle) => toggle
			.setValue(rule.required).onChange((value) => (rule.required = value)));
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

	private addCustomFieldRef(): void {
		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		if (pool.length === 0) {
			new Notice('暂无可用元数据字段，请先在「元数据管理」页面创建统一元数据字段。');
			return;
		}
		const existingIds = new Set((this.value.customFieldRefs ?? []).map((ref) => ref.unifiedMetadataFieldId));
		const available = pool.filter((field) => !existingIds.has(field.id));
		if (available.length === 0) {
			new Notice('所有元数据字段已被引用。');
			return;
		}
		const modal = new Modal(this.manager.app);
		modal.setTitle('添加自定义元数据');
		const list = modal.contentEl.createDiv({ cls: 'op-unified-field-picker' });
		for (const field of available) {
			const row = list.createEl('button', { cls: 'op-unified-field-picker-item' });
			row.createSpan({ text: `${field.name}（${field.key}）` });
			row.createSpan({ cls: 'op-unified-field-picker-type', text: TYPE_LABELS[field.type as TaskMetadataCustomFieldType] ?? field.type });
			row.addEventListener('click', () => {
				const refs = this.value.customFieldRefs ?? [];
				refs.push({
					unifiedMetadataFieldId: field.id,
					showInTaskView: true,
					showInProjectCards: true,
				});
				this.value.customFieldRefs = refs;
				modal.close();
				this.render();
			});
		}
		modal.open();
	}

	private renderCustomField(field: TaskMetadataCustomFieldDefinition): void {
		const section = this.root!.createDiv({ cls: 'op-task-metadata-setting is-custom' });
		new Setting(section).setName(field.name).setDesc('自定义任务元数据（旧版）').setHeading()
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

	private renderCustomFieldRef(ref: TaskMetadataRef): void {
		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		const field = pool.find((f) => f.id === ref.unifiedMetadataFieldId);
		if (!field) {
			const section = this.root!.createDiv({ cls: 'op-task-metadata-setting is-custom' });
			new Setting(section)
				.setName('（已删除的元数据字段）')
				.setDesc('该元数据字段已从统一池中移除。')
				.setHeading()
				.addExtraButton((button) => button.setIcon('trash-2').setTooltip('移除此引用').onClick(() => {
					this.value.customFieldRefs = (this.value.customFieldRefs ?? []).filter((r) => r !== ref);
					this.render();
				}));
			return;
		}

		const section = this.root!.createDiv({ cls: 'op-task-metadata-setting is-custom' });
		new Setting(section).setName(field.name).setDesc('统一元数据字段').setHeading()
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('移除此引用').onClick(() => {
				this.value.customFieldRefs = (this.value.customFieldRefs ?? []).filter((r) => r !== ref);
				this.render();
			}));

		// Show field info from unified pool
		new Setting(section)
			.setName('字段信息')
			.setDesc(`键：${field.key} · 类型：${TYPE_LABELS[field.type as TaskMetadataCustomFieldType] ?? field.type}${field.icon ? ` · 图标：${field.icon}` : ''}`);

		new Setting(section).setName('任务视图显示').addToggle((toggle) => toggle
			.setValue(ref.showInTaskView).onChange((value) => (ref.showInTaskView = value)));
		new Setting(section).setName('项目卡片显示').addToggle((toggle) => toggle
			.setValue(ref.showInProjectCards).onChange((value) => (ref.showInProjectCards = value)));
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