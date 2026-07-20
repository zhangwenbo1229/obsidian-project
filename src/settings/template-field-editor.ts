import { Modal, Notice, Setting } from 'obsidian';
import type {
	CustomFieldType,
	ProjectTemplateMetadataRef,
	TaskConfigurationTemplate,
	TaskTypeDefinition,
} from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import {
	normalizeTaskFieldConfig,
} from './task-field-configuration';
import { attachDragHandlers } from './person-metadata-settings-editor';

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
		new Setting(container)
			.setName('项目元数据字段')
			.setDesc('引用元数据管理中的统一字段，自动同步到新增、编辑项目弹窗。')
			.addButton((button) => button.setButtonText('新增项目元数据').setIcon('plus').onClick(() => {
				this.addCustomField();
				this.rerender();
			}));

		this.renderBodyTemplateEditor(container);
		this.renderSubtasksToggle(container);

		for (const [index, ref] of (this.template.customFieldRefs ?? []).entries()) {
			this.renderCustomFieldRef(container, ref, index);
		}
	}

	private renderBodyTemplateEditor(container: HTMLElement): void {
		const fieldContainer = container.createDiv({ cls: 'op-template-field-setting' });
		new Setting(fieldContainer)
			.setName('项目描述模板')
			.setDesc('使用 Markdown 编写新增项目的默认描述。')
			.addTextArea((area) => {
				area.inputEl.addClass('op-template-field-default');
				area.setValue(this.type.template ?? '').onChange((value) => {
					this.type.template = value;
				});
			});
	}

	private renderSubtasksToggle(container: HTMLElement): void {
		this.type.fieldConfig = normalizeTaskFieldConfig(this.type.fieldConfig);
		const rule = this.type.fieldConfig!.subtasks!;
		const fieldContainer = container.createDiv({ cls: 'op-template-field-setting' });
		new Setting(fieldContainer)
			.setName('任务')
			.setDesc('启用后在新增项目中显示任务编辑器。')
			.addToggle((toggle) => toggle.setTooltip('启用').setValue(rule.enabled).onChange((enabled) => {
				rule.enabled = enabled;
			}));
	}

	private addCustomField(): void {
		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		if (pool.length === 0) {
			new Notice('暂无可用元数据字段，请先在「元数据管理」页面创建统一元数据字段。');
			return;
		}
		const existingIds = new Set((this.template.customFieldRefs ?? []).map((ref) => ref.unifiedMetadataFieldId));
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
			row.createSpan({ cls: 'op-unified-field-picker-type', text: CUSTOM_FIELD_TYPE_LABELS[field.type] ?? field.type });
			row.addEventListener('click', () => {
				const refs = this.template.customFieldRefs ?? [];
				refs.push({ unifiedMetadataFieldId: field.id });
				this.template.customFieldRefs = refs;
				modal.close();
				this.rerender();
			});
		}
		modal.open();
	}

	private renderCustomFieldRef(container: HTMLElement, ref: ProjectTemplateMetadataRef, index: number): void {
		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		const field = pool.find((f) => f.id === ref.unifiedMetadataFieldId);
		if (!field) {
			const fieldContainer = container.createDiv({
				cls: 'op-template-field-setting is-custom is-ref is-deleted',
				attr: { draggable: 'true', 'data-index': String(index) },
			});
			attachDragHandlers(fieldContainer, index, () => this.template.customFieldRefs ?? [], () => this.rerender());
			new Setting(fieldContainer)
				.setName('（已删除的元数据字段）')
				.setDesc('该字段已从统一元数据池中移除。')
				.addExtraButton((button) => button.setIcon('grip-vertical').setTooltip('拖拽排序').setDisabled(true))
				.addExtraButton((button) => button.setIcon('trash-2').setTooltip('移除此引用').onClick(() => {
					this.template.customFieldRefs = (this.template.customFieldRefs ?? []).filter((item) => item !== ref);
					this.rerender();
				}));
			return;
		}
		const fieldContainer = container.createDiv({
			cls: 'op-template-field-setting is-custom is-ref',
			attr: { draggable: 'true', 'data-index': String(index) },
		});
		attachDragHandlers(fieldContainer, index, () => this.template.customFieldRefs ?? [], () => this.rerender());
		new Setting(fieldContainer)
			.setName(field.name)
			.setDesc(`键：${field.key} · 类型：${CUSTOM_FIELD_TYPE_LABELS[field.type] ?? field.type}${field.required ? ' · 必填' : ''}`)
			.addExtraButton((button) => button.setIcon('grip-vertical').setTooltip('拖拽排序').setDisabled(true))
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('移除此引用').onClick(() => {
				this.template.customFieldRefs = (this.template.customFieldRefs ?? []).filter((item) => item !== ref);
				this.rerender();
			}));
	}
}
