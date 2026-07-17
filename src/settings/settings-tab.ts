import { App, Notice, PluginSettingTab, setIcon, Setting } from 'obsidian';
import type ObsidianProjectPlugin from '../main';
import { PersonModal } from '../modals/person-modal';
import { ProjectSettingsEditor } from './project-editor';
import { SETTINGS_PAGES, SettingsNavigation, type SettingsRootPage } from './settings-navigation';
import { TemplateSettingsEditor } from './template-editor';
import { ViewDisplaySettingsEditor } from './view-display-editor';
import { PersonalDashboardSettingsEditor } from './personal-dashboard-settings-editor';
import { ConfigurationTransferEditor } from './configuration-transfer-editor';
import { TaskMetadataSettingsEditor } from './task-metadata-settings-editor';
import { PersonMetadataSettingsEditor } from './person-metadata-settings-editor';

const PAGE_LABELS: Record<SettingsRootPage, string> = {
	general: '常规',
	people: '人员',
	templates: '项目模板',
	projects: '分组',
	'personal-dashboard': '个人仪表盘',
	'view-display': '视图显示',
	'task-metadata': '任务元数据',
	'configuration-data': '配置数据',
};

const PAGE_ICONS: Record<SettingsRootPage, string> = {
	general: 'settings-2',
	people: 'users',
	templates: 'file-text',
	projects: 'folder-kanban',
	'personal-dashboard': 'layout-dashboard',
	'view-display': 'panels-top-left',
	'task-metadata': 'list-checks',
	'configuration-data': 'import',
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
		else if (this.navigation.page === 'personal-dashboard') this.renderPersonalDashboard(content);
		else if (this.navigation.page === 'view-display') this.renderViewDisplay(content);
		else if (this.navigation.page === 'task-metadata') this.renderTaskMetadata(content);
		else if (this.navigation.page === 'configuration-data') this.renderConfigurationData(content);
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
		new Setting(section).setName('增强标签侧边栏').setDesc('开启标签样式、分组、拖拽与行内重命名。').addToggle((toggle) => toggle
			.setValue(this.plugin.manager.nativeSidebarSettings.tagsEnabled)
			.onChange((tagsEnabled) => void this.runAction(() => this.plugin.manager.saveNativeSidebarSettings({ ...this.plugin.manager.nativeSidebarSettings, tagsEnabled }))));
		new Setting(section).setName('增强属性侧边栏').setDesc('开启属性颜色、图标及分组显示。').addToggle((toggle) => toggle
			.setValue(this.plugin.manager.nativeSidebarSettings.propertiesEnabled)
			.onChange((propertiesEnabled) => void this.runAction(() => this.plugin.manager.saveNativeSidebarSettings({ ...this.plugin.manager.nativeSidebarSettings, propertiesEnabled }))));
		new Setting(section)
			.setName('启动时打开个人仪表盘')
			.setDesc('Obsidian 工作区加载完成后，自动打开或定位到个人仪表盘。')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.manager.personalDashboardSettings.openPersonalDashboardOnStartup)
				.onChange((value) => void this.runAction(async () => {
					await this.plugin.manager.savePersonalDashboardSettings({
						...this.plugin.manager.personalDashboardSettings,
						openPersonalDashboardOnStartup: value,
					});
				})));
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
		const source = this.plugin.manager.peopleSourceSettings;
		new Setting(section).setName('从文件元数据读取人员').setDesc('读取指定文件夹下 Markdown 文件的属性，不修改源文件。').addToggle((toggle) => toggle
			.setValue(source.enabled).onChange((enabled) => { source.enabled = enabled; }));
		new Setting(section).setName('人员文件夹').addText((text) => text.setValue(source.folder).onChange((folder) => (source.folder = folder)));
		new Setting(section).setName('名称属性').addText((text) => text.setValue(source.nameProperty).onChange((value) => (source.nameProperty = value)));
		new Setting(section).addButton((button) => button.setButtonText('保存并刷新人员').onClick(() => void this.runAction(() => this.plugin.manager.savePeopleSourceSettings(source))));
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

		const metadataSection = section.createDiv({ cls: 'op-person-metadata-settings' });
		new PersonMetadataSettingsEditor(this.plugin.manager).mount(metadataSection);
		new Setting(section).setName('人员列表').setDesc('编辑姓名、启用状态和人员元数据。').setHeading()
			.addButton((button) => button.setButtonText('新增人员').setCta().onClick(() => new PersonModal(this.plugin.manager, undefined, () => this.display()).open()));
		for (const person of this.plugin.manager.globalConfig.people) {
			const isCurrentUser = person.id === this.plugin.manager.globalConfig.currentUserId;
			new Setting(section)
				.setName(person.name || '未命名人员')
				.setDesc(person.sourcePath ? `来源：${person.sourcePath}` : `${Object.keys(person.metadata ?? {}).length} 个元数据值`)
				.addButton((button) => button.setButtonText('编辑').onClick(() => new PersonModal(this.plugin.manager, person, () => this.display()).open()))
				.addButton((button) => button
					.setButtonText('删除')
					.setWarning()
					.setDisabled(isCurrentUser)
					.setTooltip(isCurrentUser ? '请先切换当前用户' : '删除人员及其人员文件')
					.onClick(() => void this.runAction(async () => {
						await this.plugin.manager.deletePerson(person.id);
						this.display();
					})));
		}
	}

	private renderTemplates(container: HTMLElement): void {
		this.renderPageHeading(container, '项目模板', '集中管理项目类型、Markdown 描述、自定义字段和工作流，分组只负责选择启用。');
		const section = container.createDiv({ cls: 'op-settings-section op-template-settings' });
		new TemplateSettingsEditor(this.plugin.manager).mount(section);
	}

	private renderProjects(container: HTMLElement): void {
		this.renderPageHeading(container, '项目配置', '分组仅管理基础信息和启用的项目模板。');
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
		this.renderPageHeading(container, '视图显示', '控制项目四种视图模式中的任务字段与显示顺序。');
		const section = container.createDiv({ cls: 'op-settings-section op-view-display-settings' });
		new ViewDisplaySettingsEditor(this.plugin.manager).mount(section);
	}

	private renderPersonalDashboard(container: HTMLElement): void {
		this.renderPageHeading(container, '个人仪表盘', '管理个人仪表盘可用卡片类型，以及天气服务的全局连接配置。');
		const section = container.createDiv({ cls: 'op-settings-section op-personal-dashboard-settings' });
		new PersonalDashboardSettingsEditor(this.plugin.manager).mount(section);
	}

	private renderConfigurationData(container: HTMLElement): void {
		this.renderPageHeading(container, '配置数据', '导出可移植配置，或在验证和预览后导入配置。');
		const section = container.createDiv({ cls: 'op-settings-section op-configuration-transfer' });
		new ConfigurationTransferEditor(this.plugin.manager).mount(section);
	}

	private renderTaskMetadata(container: HTMLElement): void {
		this.renderPageHeading(container, '任务元数据', '统一控制 Tasks 元数据在任务视图与项目卡片中的图标、颜色和可见性。');
		const section = container.createDiv({ cls: 'op-settings-section op-task-metadata-settings' });
		new TaskMetadataSettingsEditor(this.plugin.manager).mount(section);
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
