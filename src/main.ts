import { Notice, Plugin } from 'obsidian';
import { registerCommands } from './commands/register-commands';
import { ProjectManager } from './services/project-manager';
import { ObsidianProjectSettingTab } from './settings/settings-tab';
import { PERSONAL_VIEW_TYPE, PersonalView } from './views/personal-view';
import { PROJECT_VIEW_TYPE, ProjectView } from './views/project-view';
import type { ConfigurationSnapshot } from './settings/configuration-store';
import { registerBuiltinTagEditor } from './integrations/builtin-tag-editor';

interface PluginData {
	legacyGlobalConfigPath: string;
	configuration: ConfigurationSnapshot | null;
}

export default class ObsidianProjectPlugin extends Plugin {
	manager!: ProjectManager;
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
		await this.manager.initialize();
		this.registerView(PERSONAL_VIEW_TYPE, (leaf) => new PersonalView(leaf, this.manager));
		this.registerView(PROJECT_VIEW_TYPE, (leaf) => new ProjectView(leaf, this.manager));
		registerCommands(this);
		registerBuiltinTagEditor(this, this.manager);
		this.addSettingTab(new ObsidianProjectSettingTab(this.app, this));
		this.addRibbonIcon('layout-dashboard', '打开个人仪表盘', () => void this.activatePersonalView());
		this.addRibbonIcon('panels-top-left', '打开项目视图', () => void this.activateProjectView());

		let refreshTimer: number | undefined;
		const changedPaths = new Set<string>();
		const scheduleRefresh = (...paths: string[]) => {
			for (const path of paths) changedPaths.add(path);
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => {
				const pending = [...changedPaths];
				changedPaths.clear();
				void this.manager.refreshPaths(pending).catch((error) => {
					new Notice(error instanceof Error ? error.message : String(error));
				});
			}, 150);
		};
		this.registerEvent(this.app.vault.on('create', (file) => scheduleRefresh(file.path)));
		this.registerEvent(this.app.vault.on('modify', (file) => scheduleRefresh(file.path)));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => scheduleRefresh(oldPath, file.path)));
		this.registerEvent(this.app.vault.on('delete', (file) => scheduleRefresh(file.path)));
		this.registerEvent(this.app.workspace.on('file-open', (file) => {
			if (file) void this.manager.recordDashboardFileOpen(file.path).catch((error: unknown) => {
				new Notice(error instanceof Error ? error.message : String(error));
			});
		}));
		this.register(() => window.clearTimeout(refreshTimer));
	}

	async activatePersonalView(): Promise<void> {
		await this.activateView(PERSONAL_VIEW_TYPE);
	}

	async activateProjectView(): Promise<void> {
		await this.activateView(PROJECT_VIEW_TYPE);
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
