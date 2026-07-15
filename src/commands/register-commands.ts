import { Platform } from 'obsidian';
import type ObsidianProjectPlugin from '../main';
import { CreateTaskModal } from '../modals/create-task-modal';
import { COMMAND_IDS } from './command-ids';

export function registerCommands(plugin: ObsidianProjectPlugin): void {
	plugin.addCommand({
		id: COMMAND_IDS[0],
		name: '打开个人仪表盘',
		callback: () => void plugin.activatePersonalView(),
	});
	plugin.addCommand({
		id: COMMAND_IDS[1],
		name: '打开项目视图',
		callback: () => void plugin.activateProjectView(),
	});
	plugin.addCommand({
		id: COMMAND_IDS[2],
		name: '新增任务',
		checkCallback: (checking) => {
			const available = !Platform.isMobile && plugin.manager.projects.some((project) => project.active);
			if (!checking && available) new CreateTaskModal(plugin.manager).open();
			return available;
		},
	});
}
