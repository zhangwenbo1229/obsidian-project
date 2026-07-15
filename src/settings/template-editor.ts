import { Notice, Setting } from 'obsidian';
import type { CustomFieldType, TaskConfigurationTemplate } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { createUuid } from '../utils/ids';
import { renderWorkflowEditor } from './workflow-editor';
import { TaskMarkerPickerModal } from '../modals/task-marker-picker-modal';
import { normalizeTaskFieldConfig } from './task-field-configuration';
import { TemplateFieldEditor } from './template-field-editor';

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
	text: '单行文本',
	'multiline-text': '多行文本',
	number: '数字',
	boolean: '是/否',
	date: '日期',
	datetime: '日期时间',
	'single-select': '单选',
	'multi-select': '多选',
	user: '用户',
	'task-reference': '任务引用',
};

const FIELD_TYPES = Object.keys(CUSTOM_FIELD_TYPE_LABELS) as CustomFieldType[];

function customDefaultText(value: unknown): string {
	if (Array.isArray(value)) return value.map((item) => typeof item === 'string' || typeof item === 'number' ? String(item) : '').filter(Boolean).join(', ');
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

function addCustomFieldOption(template: TaskConfigurationTemplate, fieldId: string): void {
	const field = template.customFields.find((item) => item.id === fieldId);
	if (!field) return;
	const index = (field.options?.length ?? 0) + 1;
	field.options = [...(field.options ?? []), { id: `option-${index}`, name: `选项 ${index}` }];
}

function newTemplate(): TaskConfigurationTemplate {
	return {
		id: createUuid(),
		name: '新任务类型模板',
		description: '',
		taskTypes: [{ id: `type-${createUuid().slice(0, 8)}`, name: '新任务类型', icon: 'circle-check', color: '#0c66e4', marker: 'circle-check', titleColor: '#0c66e4', active: true, template: '', fieldConfig: normalizeTaskFieldConfig() }],
		customFields: [],
		workflow: {
			initialStatusId: 'waiting',
			statuses: [
				{ id: 'waiting', name: '待处理', category: 'todo', result: null, active: true },
				{ id: 'doing', name: '进行中', category: 'in_progress', result: null, active: true },
				{ id: 'completed', name: '已完成', category: 'done', result: 'completed', active: true },
			],
			transitions: [
				{ id: createUuid(), name: '开始处理', from: 'waiting', to: 'doing' },
				{ id: createUuid(), name: '完成', from: 'doing', to: 'completed' },
			],
		},
	};
}

export class TemplateSettingsEditor {
	private selectedId = '';
	private draft: TaskConfigurationTemplate | null = null;

	constructor(private readonly manager: ProjectManager) {}

	mount(container: HTMLElement): void {
		container.empty();
		const layout = container.createDiv({ cls: 'op-template-catalog' });
		const sidebar = layout.createDiv({ cls: 'op-template-catalog-list' });
		const add = sidebar.createEl('button', { cls: 'mod-cta', text: '新增任务类型模板' });
		add.addEventListener('click', () => this.addTemplate(container));
		for (const template of this.manager.taskTemplates) {
			const button = sidebar.createEl('button', { cls: 'op-template-list-item' });
			button.createEl('strong', { text: template.taskTypes[0]?.name ?? template.name });
			button.createEl('small', { text: `${template.workflow.statuses.length} 个状态 · ${template.customFields.length} 个字段` });
			button.toggleClass('is-active', template.id === this.selectedId);
			button.addEventListener('click', () => {
				this.selectedId = template.id;
				this.draft = structuredClone(template);
				this.mount(container);
			});
		}
		if (!this.draft && this.manager.taskTemplates[0]) {
			this.selectedId = this.manager.taskTemplates[0].id;
			this.draft = structuredClone(this.manager.taskTemplates[0]);
		}
		const detail = layout.createDiv({ cls: 'op-template-catalog-detail' });
		if (!this.draft) {
			detail.createEl('p', { cls: 'op-empty-state', text: '创建第一个模板后，可集中管理任务类型、字段与工作流。' });
			return;
		}
		this.renderDetail(detail, container);
	}

	private addTemplate(container: HTMLElement): void {
		this.draft = newTemplate();
		this.selectedId = this.draft.id;
		this.mount(container);
	}

	private renderDetail(detail: HTMLElement, root: HTMLElement): void {
		const template = this.draft!;
		const type = template.taskTypes[0] ?? newTemplate().taskTypes[0]!;
		template.taskTypes = [type];
		new Setting(detail).setName('模板信息').setHeading();
		new Setting(detail).setName('模板名称').addText((text) => text.setValue(template.name).onChange((value) => (template.name = value)));
		new Setting(detail).setName('说明').addTextArea((area) => area.setValue(template.description).onChange((value) => (template.description = value)));

		new Setting(detail).setName('任务类型').setDesc('每条模板只负责一个任务类型。').setHeading();
		const card = detail.createDiv({ cls: 'op-template-type-editor' });
		new Setting(card)
			.setName(type.name)
			.addText((text) => text.setPlaceholder('ID').setValue(type.id).onChange((value) => (type.id = value.trim())))
			.addText((text) => text.setPlaceholder('名称').setValue(type.name).onChange((value) => { type.name = value; template.name = value; }))
			.addToggle((toggle) => toggle.setTooltip('启用').setValue(type.active).onChange((value) => (type.active = value)));
		new Setting(card)
			.setName('任务标识')
			.setDesc('输入 emoji，或 lucide 图标名称，例如 bug、circle-check。')
			.addText((text) => text.setPlaceholder('例如 circle-check 或 ✅').setValue(type.marker ?? type.icon).onChange((value) => (type.marker = value.trim())))
			.addButton((button) => button.setButtonText('选择图形').onClick(() => {
				new TaskMarkerPickerModal(this.manager.app, type.marker ?? type.icon, (marker) => {
					type.marker = marker;
					this.mount(root);
				}).open();
			}));
		new Setting(card)
			.setName('任务标题颜色')
			.setDesc('控制个人仪表盘和项目视图中的任务标题颜色。')
			.addColorPicker((picker) => picker.setValue(type.titleColor ?? '#0c66e4').onChange((value) => (type.titleColor = value)))
			.addExtraButton((button) => button.setIcon('rotate-ccw').setTooltip('使用主题文字颜色').onClick(() => {
				type.titleColor = undefined;
				this.mount(root);
			}));

		new Setting(detail).setName('内置字段').setDesc('每个任务类型独立控制字段显示、必填和默认值。').setHeading();
		const fieldConfig = detail.createDiv({ cls: 'op-template-field-config' });
		new TemplateFieldEditor(this.manager, type, () => this.mount(root)).mount(fieldConfig);

		new Setting(detail).setName('自定义字段').setHeading();
		for (const field of template.customFields) {
			new Setting(detail)
				.setName(field.name)
				.addText((text) => text.setPlaceholder('字段键').setValue(field.key).onChange((value) => (field.key = value.trim())))
				.addText((text) => text.setPlaceholder('显示名称').setValue(field.name).onChange((value) => (field.name = value)))
				.addDropdown((dropdown) => {
					for (const type of FIELD_TYPES) dropdown.addOption(type, CUSTOM_FIELD_TYPE_LABELS[type]);
					dropdown.setValue(field.type).onChange((value) => (field.type = value as CustomFieldType));
				})
				.addToggle((toggle) => toggle.setTooltip('启用').setValue(field.active).onChange((value) => (field.active = value)))
				.addToggle((toggle) => toggle.setTooltip('必填').setValue(field.required).onChange((value) => (field.required = value)))
				.addExtraButton((button) => button.setIcon('trash').setTooltip('删除字段').onClick(() => {
					template.customFields = template.customFields.filter((item) => item !== field);
					this.mount(root);
				}));
			new Setting(detail).setName(`${field.name}样式`)
				.setDesc(field.icon ? `图标：${field.icon}` : '未设置图标')
				.addButton((button) => button.setButtonText('选择图标').onClick(() => {
					new TaskMarkerPickerModal(this.manager.app, field.icon ?? '', (icon) => {
						field.icon = icon;
						this.mount(root);
					}).open();
				}))
				.addColorPicker((picker) => picker.setValue(field.color ?? '#626f86').onChange((color) => (field.color = color)))
				.addExtraButton((button) => button.setIcon('rotate-ccw').setTooltip('清除样式').onClick(() => {
					field.icon = undefined;
					field.color = undefined;
					this.mount(root);
				}));
			const fieldOptions = new Setting(detail).setName(`${field.name}配置`);
			if (field.type === 'boolean') {
				fieldOptions.addToggle((toggle) => toggle.setTooltip('默认值').setValue(Boolean(field.default)).onChange((value) => (field.default = value)));
			} else {
				fieldOptions.addText((text) => text.setPlaceholder('默认值').setValue(customDefaultText(field.default)).onChange((value) => {
					field.default = field.type === 'number' ? (value ? Number(value) : null) : field.type === 'multi-select' ? value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean) : value || null;
				}));
			}
			if (field.type === 'single-select' || field.type === 'multi-select') {
				for (const option of field.options ?? []) {
					new Setting(detail).setName('选项')
						.addText((text) => text.setPlaceholder('选项 ID').setValue(option.id).onChange((id) => (option.id = id.trim())))
						.addText((text) => text.setPlaceholder('显示名称').setValue(option.name).onChange((name) => (option.name = name)))
						.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除选项').onClick(() => {
							field.options = field.options?.filter((item) => item !== option);
							this.mount(root);
						}));
				}
				new Setting(detail).addButton((button) => button.setButtonText('新增选项').setIcon('plus').onClick(() => {
					addCustomFieldOption(template, field.id);
					this.mount(root);
				}));
			}
		}
		new Setting(detail).addButton((button) => button.setButtonText('新增自定义字段').onClick(() => {
			const index = template.customFields.length + 1;
			template.customFields.push({ id: createUuid(), key: `field-${index}`, name: `字段 ${index}`, type: 'text', required: false, active: true, default: null });
			this.mount(root);
		}));

		new Setting(detail).setName('工作流与状态转换').setDesc('节点展示状态分类，箭头展示允许的转换方向。').setHeading();
		const workflowHost = detail.createDiv({ cls: 'op-template-workflow' });
		renderWorkflowEditor(workflowHost, template.workflow, () => this.mount(root));

		new Setting(detail)
			.addButton((button) => button.setButtonText('保存模板').setCta().onClick(() => void this.save(root)))
			.addButton((button) => button.setWarning().setButtonText('删除模板').onClick(() => void this.remove(root)));
	}

	private async save(root: HTMLElement): Promise<void> {
		try {
			await this.manager.saveTaskTemplate(this.draft!);
			this.draft = structuredClone(this.manager.taskTemplates.find((item) => item.id === this.selectedId) ?? this.draft);
			new Notice('任务模板已保存，并同步到启用该模板的项目。');
			this.mount(root);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async remove(root: HTMLElement): Promise<void> {
		try {
			await this.manager.deleteTaskTemplate(this.selectedId);
			this.selectedId = '';
			this.draft = null;
			this.mount(root);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
