import { Menu } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { IndexedTask } from '../index/task-index';
import type ObsidianProjectPlugin from '../main';

export function openTaskCardContextMenu(event: MouseEvent, task: IndexedTask, manager: ProjectManager): void {
	event.preventDefault();
	event.stopPropagation();
	const menu = new Menu();
	menu.addItem((item) => item
		.setTitle('编辑项目')
		.setIcon('folder-edit')
		.onClick(() => {
			const app = manager.app as unknown as {
				plugins: { plugins: Record<string, unknown> };
				setting: { open: () => void; openTab: (tab: unknown) => void };
			};
			const plugin = app.plugins.plugins['obsidian-project'] as ObsidianProjectPlugin | undefined;
			if (!plugin?.settingsTab) return;
			app.setting.open();
			app.setting.openTab(plugin.settingsTab);
			plugin.settingsTab.openProjectDetail(task.project.uid);
		}));
	menu.showAtMouseEvent(event);
}
