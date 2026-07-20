import { Notice, Plugin } from 'obsidian';
import { registerCommands } from './commands/register-commands';
import { ProjectManager } from './services/project-manager';
import { ObsidianProjectSettingTab } from './settings/settings-tab';
import { PERSONAL_VIEW_TYPE, PersonalView } from './views/personal-view';
import { PROJECT_VIEW_TYPE, ProjectView } from './views/project-view';
import { TASK_VIEW_TYPE, TaskView } from './views/task-view';
import { ConfigurationSnapshot } from './settings/configuration-store';
import { registerBuiltinTagEditor } from './integrations/builtin-tag-editor';
import { registerBuiltinPropertyEditor } from './integrations/builtin-property-editor';
import { PropertyStyleModal } from './modals/property-style-modal';
import { PropertyGroupModal } from './modals/property-group-modal';
import { decorateMarkdownReferencesWhenReady } from './integrations/markdown-reference-renderer';
import { registerFileWatcher } from './services/file-watcher-service';
import { resolvePersonNamePresentation } from './services/person-metadata';

interface PluginData {
	legacyGlobalConfigPath: string;
	configuration: ConfigurationSnapshot | null;
}

export default class ObsidianProjectPlugin extends Plugin {
	manager!: ProjectManager;
	settingsTab!: ObsidianProjectSettingTab;
	settings: PluginData = {
		legacyGlobalConfigPath: '项目管理/全局配置.md',
		configuration: null,
	};

	async onload(): Promise<void> {
		this.settings = Object.assign(this.settings, await this.loadData() as Partial<PluginData> | null);
		this.manager = new ProjectManager(this.app, {
			load: async () => this.settings.configuration ? structuredClone(this.settings.configuration) : null,
			save: async (configuration) => {
				this.settings.configuration = structuredClone(configuration);
				await this.savePluginSettings();
			},
		}, this.settings.legacyGlobalConfigPath);
		await this.manager.initializeConfiguration();
		this.registerView(PERSONAL_VIEW_TYPE, (leaf) => new PersonalView(leaf, this.manager));
		this.registerView(PROJECT_VIEW_TYPE, (leaf) => new ProjectView(leaf, this.manager));
		this.registerView(TASK_VIEW_TYPE, (leaf) => new TaskView(leaf, this.manager));
		registerCommands(this);
		registerBuiltinTagEditor(this, this.manager);
		registerBuiltinPropertyEditor(
			this,
			() => this.manager.nativeSidebarSettings,
			(key) => new PropertyStyleModal(this.manager, key).open(),
			(groupId) => new PropertyGroupModal(this.manager, this.manager.nativeSidebarSettings.propertyGroups.find((group) => group.id === groupId)).open(),
			(groupId) => void this.manager.deletePropertyGroup(groupId),
		);
		const taskIndexReady = this.manager.initializeTaskIndex().catch((error) => {
			new Notice(error instanceof Error ? error.message : String(error));
		});
		this.registerMarkdownPostProcessor((element) => decorateMarkdownReferencesWhenReady(
			element,
			taskIndexReady,
			() => this.manager.index.validTasks().map((task) => ({
				key: task.document.metadata.key,
				title: task.document.metadata.title,
				icon: task.project.taskTypes.find((type) => type.id === task.document.metadata.taskTypeId)?.marker,
				color: task.project.taskTypes.find((type) => type.id === task.document.metadata.taskTypeId)?.titleColor,
			})),
			() => this.manager.globalConfig.people.map((person) => {
				const presentation = resolvePersonNamePresentation(
					this.manager.globalConfig.personNamePresentation,
					this.manager.globalConfig.unifiedMetadataFields ?? [],
				);
				return {
					name: person.name,
					sourcePath: person.sourcePath,
					title: presentation?.title ? `${presentation.title}：${person.name}` : person.name,
					icon: presentation?.icon,
					color: presentation?.color,
				};
			}),
		));
		this.settingsTab = new ObsidianProjectSettingTab(this.app, this);
	this.addSettingTab(this.settingsTab);
		this.addRibbonIcon('layout-dashboard', '打开个人仪表盘', () => void this.activatePersonalView());
		this.addRibbonIcon('panels-top-left', '打开项目视图', () => void this.activateProjectView());
		this.addRibbonIcon('list-checks', '打开任务视图', () => void this.activateTaskView());
		this.app.workspace.onLayoutReady(() => {
			if (this.manager.personalDashboardSettings.openPersonalDashboardOnStartup) {
				void this.activatePersonalView();
			}
		});
		registerFileWatcher(this, this.app, this.manager);
		this.registerEvent(this.app.workspace.on('file-open', (file) => {
			if (file) void this.manager.recordDashboardFileOpen(file.path).catch((error: unknown) => {
				new Notice(error instanceof Error ? error.message : String(error));
			});
		}));
	}

	async activatePersonalView(): Promise<void> {
		await this.activateView(PERSONAL_VIEW_TYPE);
	}

	async activateProjectView(): Promise<void> {
		await this.activateView(PROJECT_VIEW_TYPE);
	}

	async activateTaskView(): Promise<void> {
		await this.activateView(TASK_VIEW_TYPE);
	}

	async saveGlobalConfig(): Promise<void> {
		await this.manager.saveGlobalConfig();
	}

	async savePluginSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async activateView(type: string): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(type)[0];
		if (!leaf) {
			leaf = this.app.workspace.getLeaf('tab');
			await leaf.setViewState({ type, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
	}
}
