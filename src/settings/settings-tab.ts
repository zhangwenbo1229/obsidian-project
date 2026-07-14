import { App, Notice, PluginSettingTab, setIcon, Setting } from 'obsidian';
import type ObsidianProjectPlugin from '../main';
import { createUuid } from '../utils/ids';
import { ProjectSettingsEditor } from './project-editor';
import { SETTINGS_PAGES, SettingsNavigation, type SettingsRootPage } from './settings-navigation';
import { TemplateSettingsEditor } from './template-editor';
import { ViewDisplaySettingsEditor } from './view-display-editor';

const PAGE_LABELS: Record<SettingsRootPage, string> = {
	general: '常规',
	people: '人员',
	templates: '任务模板',
	projects: '项目',
	'view-display': '视图显示',
};

const PAGE_ICONS: Record<SettingsRootPage, string> = {
	general: 'settings-2',
	people: 'users',
	templates: 'file-text',
	projects: 'folder-kanban',
	'view-display': 'panels-top-left',
};

export class ObsidianProjectSettingTab extends PluginSettingTab {
	private readonly navigation = new SettingsNavigation();

	constructor(app: App, private readonly plugin: ObsidianProjectPlugin) {
		super(app, plugin);
	}

	display(): void {
		this.containerEl.empty();
		this.containerEl.addClass('op-settings-root');
		const header = this.containerEl.createDiv({ cls: 'op-settings-header' });
		header.createDiv({ cls: 'op-eyebrow', text: 'OBSIDIAN PROJECT' });
		new Setting(header).setName('项目管理设置').setHeading();
		header.createEl('p', { text: '全局、人员与项目配置集中在这里管理。' });

		const shell = this.containerEl.createDiv({ cls: 'op-settings-shell' });
		this.renderNavigation(shell);
		const content = shell.createEl('main', { cls: 'op-settings-content' });
		if (this.navigation.page === 'general') this.renderGeneral(content);
		else if (this.navigation.page === 'people') this.renderPeople(content);
		else if (this.navigation.page === 'templates') this.renderTemplates(content);
		else if (this.navigation.page === 'projects') this.renderProjects(content);
		else if (this.navigation.page === 'view-display') this.renderViewDisplay(content);
		else this.renderProjectDetail(content);
	}

	private renderNavigation(shell: HTMLElement): void {
		const navigation = shell.createEl('nav', { cls: 'op-settings-nav' });
		for (const page of SETTINGS_PAGES) {
			const button = navigation.createEl('button', { cls: 'op-settings-nav-item' });
			const icon = button.createSpan({ cls: 'op-settings-nav-icon' });
			setIcon(icon, PAGE_ICONS[page]);
			button.createSpan({ text: PAGE_LABELS[page] });
			button.toggleClass(
				'is-active',
				this.navigation.page === page || (page === 'projects' && this.navigation.page === 'project-detail'),
			);
			button.addEventListener('click', () => {
				this.navigation.open(page);
				this.display();
			});
		}
	}

	private renderPageHeading(
		container: HTMLElement,
		title: string,
		description: string,
	): void {
		const heading = container.createDiv({ cls: 'op-settings-page-heading' });
		new Setting(heading).setName(title).setDesc(description).setHeading();
	}

	private renderGeneral(container: HTMLElement): void {
		this.renderPageHeading(container, '常规配置', '配置统一保存在插件 data.json 中，不再创建全局或项目配置 Markdown。');
		let defaultTaskDirectory = this.plugin.manager.globalConfig.defaultTaskDirectory;

		const section = container.createDiv({ cls: 'op-settings-section' });
		new Setting(section)
			.setName('配置存储')
			.setDesc('全局配置、人员、项目、工作流、模板开关和标签顺序均由插件设置管理。');
		new Setting(section)
			.setName('默认任务目录')
			.setDesc('新建项目时使用该目录作为任务目录根路径。')
			.addText((text) => text.setValue(defaultTaskDirectory).onChange((value) => (defaultTaskDirectory = value)))
			.addButton((button) => button.setButtonText('保存').onClick(() => void this.runAction(async () => {
				this.plugin.manager.globalConfig.defaultTaskDirectory = defaultTaskDirectory.trim();
				await this.plugin.saveGlobalConfig();
			})));
	}

	private renderPeople(container: HTMLElement): void {
		this.renderPageHeading(container, '人员配置', '所有项目共享人员列表，当前用户用于新任务提报人和备注作者。');
		const section = container.createDiv({ cls: 'op-settings-section' });
		const current = this.plugin.manager.globalConfig.people.find(
			(person) => person.id === this.plugin.manager.globalConfig.currentUserId,
		);
		new Setting(section)
			.setName('当前用户')
			.setDesc('该配置随 vault 同步。')
			.addDropdown((dropdown) => {
				for (const person of this.plugin.manager.globalConfig.people.filter((item) => item.active)) {
					dropdown.addOption(person.id, person.name);
				}
				dropdown.setValue(current?.id ?? '').onChange((value) => void this.runAction(async () => {
					this.plugin.manager.globalConfig.currentUserId = value;
					await this.plugin.saveGlobalConfig();
				}));
			});

		for (const person of this.plugin.manager.globalConfig.people) {
			new Setting(section)
				.setName(person.name || '未命名人员')
				.addText((text) => text.setValue(person.name).onChange((value) => (person.name = value)))
				.addToggle((toggle) => toggle.setTooltip('启用').setValue(person.active).onChange((value) => (person.active = value)))
				.addButton((button) => button.setButtonText('保存').onClick(() => void this.runAction(
					() => this.plugin.saveGlobalConfig(),
				)));
		}

		let personName = '';
		new Setting(section)
			.setName('新增人员')
			.addText((text) => text.setPlaceholder('姓名').onChange((value) => (personName = value)))
			.addButton((button) => button.setButtonText('添加').setCta().onClick(() => void this.runAction(async () => {
				if (!personName.trim()) throw new Error('人员姓名不能为空。');
				this.plugin.manager.globalConfig.people.push({
					id: createUuid(),
					name: personName.trim(),
					active: true,
				});
				await this.plugin.saveGlobalConfig();
				this.display();
			})));
	}

	private renderTemplates(container: HTMLElement): void {
		this.renderPageHeading(container, '任务模板', '集中管理任务类型、Markdown 正文、自定义字段和工作流，项目只负责选择启用。');
		const section = container.createDiv({ cls: 'op-settings-section op-template-settings' });
		new TemplateSettingsEditor(this.plugin.manager).mount(section);
	}

	private renderProjects(container: HTMLElement): void {
		this.renderPageHeading(container, '项目配置', '项目仅管理基础信息和启用的任务模板。');
		const projectGrid = container.createDiv({ cls: 'op-settings-project-grid' });
		for (const project of this.plugin.manager.projects) {
			const card = projectGrid.createEl('button', { cls: 'op-settings-project-card' });
			const top = card.createDiv({ cls: 'op-settings-project-card-top' });
			top.createSpan({ cls: 'op-project-code', text: project.code });
			top.createSpan({ cls: project.active ? 'op-project-state is-active' : 'op-project-state', text: project.active ? '启用' : '停用' });
			card.createEl('strong', { text: project.name });
			card.createEl('small', { text: `${project.taskDirectory}${project.groupByMonth ? ' · 按月分组' : ''}` });
			card.addEventListener('click', () => {
				this.navigation.openProject(project.uid);
				this.display();
			});
		}

		const createSection = container.createDiv({ cls: 'op-settings-section op-settings-create-project' });
		new Setting(createSection).setName('创建项目').setHeading();
		let code = '';
		let name = '';
		new Setting(createSection).setName('项目代码').addText((text) =>
			text.setPlaceholder('PROJ').onChange((value) => (code = value)),
		);
		new Setting(createSection)
			.setName('项目名称')
			.addText((text) => text.setPlaceholder('项目名称').onChange((value) => (name = value)))
			.addButton((button) => button.setButtonText('创建项目').setCta().onClick(() => void this.runAction(async () => {
				await this.plugin.manager.createProject(code, name);
				const project = this.plugin.manager.projects.find((item) => item.code === code.trim().toUpperCase());
				if (project) this.navigation.openProject(project.uid);
				this.display();
			})));
	}

	private renderViewDisplay(container: HTMLElement): void {
		this.renderPageHeading(container, '视图显示', '分别控制项目四种视图模式中的任务字段。');
		const section = container.createDiv({ cls: 'op-settings-section op-view-display-settings' });
		new ViewDisplaySettingsEditor(this.plugin.manager).mount(section);
	}

	private renderProjectDetail(container: HTMLElement): void {
		const project = this.plugin.manager.projects.find(
			(item) => item.uid === this.navigation.selectedProjectUid,
		);
		if (!project) {
			this.navigation.backToProjects();
			this.display();
			return;
		}
		const heading = container.createDiv({ cls: 'op-settings-detail-heading' });
		const back = heading.createEl('button', { cls: 'op-settings-back', attr: { 'aria-label': '返回项目列表' } });
		setIcon(back, 'arrow-left');
		back.addEventListener('click', () => {
			this.navigation.backToProjects();
			this.display();
		});
		const copy = heading.createDiv();
		copy.createDiv({ cls: 'op-eyebrow', text: project.code });
		new Setting(copy)
			.setName(project.name)
			.setDesc('项目配置保存后会立即写入该项目的配置文件。')
			.setHeading();

		const editorHost = container.createDiv({ cls: 'op-settings-section op-settings-project-editor' });
		new ProjectSettingsEditor(this.plugin.manager, project).mount(editorHost, () => {
			this.navigation.backToProjects();
			this.display();
		});
	}

	private async runAction(action: () => Promise<void>): Promise<void> {
		try {
			await action();
			new Notice('配置已保存。');
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
