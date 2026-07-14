import { Modal, Notice, Setting } from 'obsidian';
import type { ProjectConfig } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';

export class ProjectConfigModal extends Modal {
	private project: ProjectConfig;
	private newProjectCode: string;
	private deleteArmed = false;
	private codeChangeArmed = false;
	private host: HTMLElement | null = null;
	private onExit: (() => void) | null = null;
	private selectedTemplateIds: Set<string>;

	constructor(private readonly manager: ProjectManager, project: ProjectConfig) {
		super(manager.app);
		this.project = structuredClone(project);
		this.newProjectCode = project.code;
		this.selectedTemplateIds = new Set(project.templateIds ?? (project.templateId ? [project.templateId] : []));
	}

	onOpen(): void {
		this.setTitle(`配置项目 · ${this.project.code}`);
		this.host = this.contentEl;
		this.render();
	}

	mount(container: HTMLElement, onExit: () => void): void {
		this.host = container;
		this.onExit = onExit;
		this.render();
	}

	private render(): void {
		const root = this.host;
		if (!root) return;
		root.empty();
		new Setting(root).setName('基础配置').setDesc('任务类型、自定义字段和工作流统一在任务模板中管理。').setHeading();
		new Setting(root).setName('项目名称').addText((text) => text.setValue(this.project.name).onChange((value) => (this.project.name = value)));
		new Setting(root).setName('启用项目').addToggle((toggle) => toggle.setValue(this.project.active).onChange((value) => (this.project.active = value)));
		new Setting(root).setName('任务目录').addText((text) => text.setValue(this.project.taskDirectory).onChange((value) => (this.project.taskDirectory = value)));
		new Setting(root).setName('按月分组').addToggle((toggle) => toggle.setValue(this.project.groupByMonth).onChange((value) => (this.project.groupByMonth = value)));
		new Setting(root).setName('启用任务类型模板').setDesc('可启用多个单类型模板；第一个启用模板提供项目工作流。').setHeading();
		for (const template of this.manager.taskTemplates) {
			const type = template.taskTypes[0];
			new Setting(root)
				.setName(type?.name ?? template.name)
				.setDesc(template.description)
				.addToggle((toggle) => toggle.setValue(this.selectedTemplateIds.has(template.id)).onChange((enabled) => {
					if (enabled) this.selectedTemplateIds.add(template.id);
					else this.selectedTemplateIds.delete(template.id);
				}));
		}

		new Setting(root).setName('项目代码').setDesc('修改代码会迁移任务文件名、key 和结构化关系。')
			.addText((text) => text.setValue(this.newProjectCode).onChange((value) => (this.newProjectCode = value)));
		new Setting(root)
			.addButton((button) => button.setButtonText(this.codeChangeArmed ? '再次选择确认修改代码' : '修改项目代码').onClick(() => {
				if (!this.codeChangeArmed) { this.codeChangeArmed = true; this.render(); return; }
				void this.changeCode();
			}))
			.addButton((button) => button.setWarning().setButtonText(this.deleteArmed ? '再次选择确认删除项目' : '删除项目').onClick(() => {
				if (!this.deleteArmed) { this.deleteArmed = true; this.render(); return; }
				void this.deleteProject();
			}))
			.addButton((button) => button.setButtonText('保存基础配置').setCta().onClick(() => void this.save()));
	}

	private finish(): void {
		if (this.onExit) this.onExit();
		else this.close();
	}

	private async save(): Promise<void> {
		try {
			if (this.selectedTemplateIds.size > 0) await this.manager.applyTemplatesToProject(this.project, [...this.selectedTemplateIds]);
			else await this.manager.saveProject({ ...this.project, templateId: null, templateIds: [] });
			this.finish();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async changeCode(): Promise<void> {
		const code = this.newProjectCode.trim();
		if (!code || code === this.project.code) return;
		try {
			await this.manager.changeProjectCode(this.project, code);
			this.finish();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async deleteProject(): Promise<void> {
		try {
			await this.manager.deleteProject(this.project);
			this.finish();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
