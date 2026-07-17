import { Notice, Platform } from 'obsidian';
import type ObsidianProjectPlugin from '../main';
import { CreateTaskModal } from '../modals/create-task-modal';
import { CreateSubtaskModal } from '../modals/create-subtask-modal';
import { PersonModal } from '../modals/person-modal';
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
		name: '新增项目',
		checkCallback: (checking) => {
			const available = !Platform.isMobile && plugin.manager.projects.some((project) => project.active);
			if (!checking && available) new CreateTaskModal(plugin.manager).open();
			return available;
		},
	});
	plugin.addCommand({
		id: COMMAND_IDS[3],
		name: '新增任务',
		callback: async () => {
			await plugin.manager.initializeTaskIndex();
			const tasks = plugin.manager.index.validTasks();
			if (tasks.length === 0) {
				new Notice('请先创建一个项目。');
				return;
			}
			const activePath = plugin.app.workspace.getActiveFile()?.path;
			const parent = activePath ? tasks.find((task) => task.path === activePath) : undefined;
			new CreateSubtaskModal(plugin.manager, parent).open();
		},
	});
	plugin.addCommand({
		id: COMMAND_IDS[4],
		name: '打开任务视图',
		callback: () => void plugin.activateTaskView(),
	});
	plugin.addCommand({
		id: COMMAND_IDS[5],
		name: '新增人员',
		callback: () => new PersonModal(plugin.manager).open(),
	});
}
