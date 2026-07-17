import { Notice, Setting } from 'obsidian';
import type { TaskConfigurationTemplate } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { createUuid } from '../utils/ids';
import { renderWorkflowEditor } from './workflow-editor';
import { TaskMarkerPickerModal } from '../modals/task-marker-picker-modal';
import { normalizeTaskFieldConfig } from './task-field-configuration';
import { TemplateFieldEditor } from './template-field-editor';

function newTemplate(): TaskConfigurationTemplate {
	return {
		id: createUuid(),
		name: '新项目类型模板',
		description: '',
		taskTypes: [{ id: `type-${createUuid().slice(0, 8)}`, name: '新项目类型', icon: 'circle-check', color: '#0c66e4', marker: 'circle-check', titleColor: '#0c66e4', active: true, template: '', fieldConfig: normalizeTaskFieldConfig() }],
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
		const add = sidebar.createEl('button', { cls: 'mod-cta', text: '新增项目类型模板' });
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
			detail.createEl('p', { cls: 'op-empty-state', text: '创建第一个模板后，可集中管理项目类型、字段与工作流。' });
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

		new Setting(detail).setName('项目类型').setDesc('每条模板只负责一个项目类型。').setHeading();
		const card = detail.createDiv({ cls: 'op-template-type-editor' });
		new Setting(card)
			.setName(type.name)
			.addText((text) => text.setPlaceholder('ID').setValue(type.id).onChange((value) => (type.id = value.trim())))
			.addText((text) => text.setPlaceholder('名称').setValue(type.name).onChange((value) => { type.name = value; template.name = value; }))
			.addToggle((toggle) => toggle.setTooltip('启用').setValue(type.active).onChange((value) => (type.active = value)));
		new Setting(card)
			.setName('项目标识')
			.setDesc('输入 emoji，或 lucide 图标名称，例如 bug、circle-check。')
			.addText((text) => text.setPlaceholder('例如 circle-check 或 ✅').setValue(type.marker ?? type.icon).onChange((value) => (type.marker = value.trim())))
			.addButton((button) => button.setButtonText('选择图形').onClick(() => {
				new TaskMarkerPickerModal(this.manager.app, type.marker ?? type.icon, (marker) => {
					type.marker = marker;
					this.mount(root);
				}).open();
			}));
		new Setting(card)
			.setName('项目标题颜色')
			.setDesc('控制个人仪表盘和项目视图中的项目标题颜色。')
			.addColorPicker((picker) => picker.setValue(type.titleColor ?? '#0c66e4').onChange((value) => (type.titleColor = value)))
			.addExtraButton((button) => button.setIcon('rotate-ccw').setTooltip('使用主题文字颜色').onClick(() => {
				type.titleColor = undefined;
				this.mount(root);
			}));

		new Setting(detail).setName('项目元数据').setDesc('统一配置内置元数据和自定义元数据；保存后同步到对应项目类型。').setHeading();
		const fieldConfig = detail.createDiv({ cls: 'op-template-field-config' });
		new TemplateFieldEditor(this.manager, template, () => this.mount(root)).mount(fieldConfig);

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
			new Notice('项目模板已保存，并同步到启用该模板的分组。');
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
