import { Notice, Setting } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import {
	normalizeProjectViewDisplay,
	type ProjectViewDisplaySettings,
	type ProjectViewMode,
} from '../views/task-display-settings';
import { SortableDisplayFields } from './sortable-display-fields';

const MODE_LABELS: Record<ProjectViewMode, string> = {
	list: '列表模式',
	board: '看板模式',
	calendar: '日历模式',
	quadrants: '四象限模式',
};

export class ViewDisplaySettingsEditor {
	private value: ProjectViewDisplaySettings;
	private activeMode: ProjectViewMode = 'list';
	private root: HTMLElement | null = null;

	constructor(private readonly manager: ProjectManager) {
		this.value = normalizeProjectViewDisplay(manager.projectViewDisplay, this.customFields());
	}

	private customFields() {
		return [...new Map(this.manager.projects.flatMap((project) => project.customFields).map((field) => [field.key, field])).values()];
	}

	mount(container: HTMLElement): void {
		this.root = container;
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		this.root.empty();
		const tabs = this.root.createDiv({ cls: 'op-view-display-tabs' });
		for (const mode of ['list', 'board', 'calendar', 'quadrants'] as const) {
			const button = tabs.createEl('button', { text: MODE_LABELS[mode] });
			button.toggleClass('is-active', mode === this.activeMode);
			button.addEventListener('click', () => {
				this.activeMode = mode;
				this.render();
			});
		}
		const panel = this.root.createDiv({ cls: 'op-view-display-panel' });
		new Setting(panel)
			.setName(MODE_LABELS[this.activeMode])
			.setDesc('拖拽调整显示顺序，选择 × 隐藏字段。')
			.setHeading();
		const fields = panel.createDiv({ cls: 'op-view-display-fields' });
		new SortableDisplayFields(this.value[this.activeMode], (next) => {
			this.value[this.activeMode] = next;
		}, this.customFields()).mount(fields);
		new Setting(this.root)
			.addButton((button) => button.setButtonText('保存视图显示配置').setCta().onClick(() => {
				void this.manager.saveProjectViewDisplay(this.value)
					.then(() => new Notice('视图显示配置已保存。'))
					.catch((error: unknown) => new Notice(error instanceof Error ? error.message : String(error)));
			}));
	}
}
