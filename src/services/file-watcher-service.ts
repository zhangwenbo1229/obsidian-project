import type { App, Plugin } from 'obsidian';
import { Notice } from 'obsidian';
import type { ProjectManager } from './project-manager';

export function registerFileWatcher(plugin: Plugin, app: App, manager: ProjectManager): void {
	let refreshTimer: number | undefined;
	const changedPaths = new Set<string>();

	const scheduleRefresh = (...paths: string[]) => {
		for (const path of paths) changedPaths.add(path);
		window.clearTimeout(refreshTimer);
		refreshTimer = window.setTimeout(() => {
			const pending = [...changedPaths];
			changedPaths.clear();
			void manager.initializeTaskIndex().then(() => manager.refreshPaths(pending)).catch((error) => {
				new Notice(error instanceof Error ? error.message : String(error));
			});
		}, 150);
	};

	plugin.registerEvent(app.vault.on('create', (file) => {
		manager.dashboardVaultCache.invalidate(file.path);
		scheduleRefresh(file.path);
	}));
	plugin.registerEvent(app.vault.on('modify', (file) => {
		manager.dashboardVaultCache.invalidate(file.path);
		scheduleRefresh(file.path);
	}));
	plugin.registerEvent(app.vault.on('rename', (file, oldPath) => {
		manager.dashboardVaultCache.invalidate(oldPath, file.path);
		scheduleRefresh(oldPath, file.path);
	}));
	plugin.registerEvent(app.vault.on('delete', (file) => {
		manager.dashboardVaultCache.invalidate(file.path);
		scheduleRefresh(file.path);
	}));

	plugin.register(() => {
		window.clearTimeout(refreshTimer);
		manager.dashboardVaultCache.clear();
	});
}