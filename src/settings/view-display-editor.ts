import { Notice, Setting } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import {
	DEFAULT_PROJECT_VIEW_DISPLAY,
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

const MODE_DESCRIPTIONS: Record<ProjectViewMode, string> = {
	list: '控制列表列及其顺序。',
	board: '控制看板任务卡片显示的字段及顺序。',
	calendar: '控制日历任务卡片显示的字段及顺序。',
	quadrants: '控制四象限任务卡片显示的字段及顺序。',
};

export class ViewDisplaySettingsEditor {
	private value: ProjectViewDisplaySettings;
	private activeMode: ProjectViewMode = 'list';
	private root: HTMLElement | null = null;
	private readonly dirtyModes = new Set<ProjectViewMode>();

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
			const button = tabs.createEl('button', { text: `${MODE_LABELS[mode]}${this.dirtyModes.has(mode) ? ' •' : ''}` });
			button.toggleClass('is-active', mode === this.activeMode);
			button.addEventListener('click', () => {
				this.activeMode = mode;
				this.render();
			});
		}
		const panel = this.root.createDiv({ cls: 'op-view-display-panel' });
		new Setting(panel)
			.setName(MODE_LABELS[this.activeMode])
			.setDesc(`${MODE_DESCRIPTIONS[this.activeMode]} 拖拽调整显示顺序，选择 × 隐藏字段。`)
			.setHeading();
		panel.createDiv({ cls: 'op-view-display-summary', text: `当前显示 ${this.value[this.activeMode].length} 个字段` });
		const fields = panel.createDiv({ cls: 'op-view-display-fields' });
		new SortableDisplayFields(this.value[this.activeMode], (next) => {
			this.value[this.activeMode] = next;
			this.dirtyModes.add(this.activeMode);
		}, this.customFields()).mount(fields);
		new Setting(panel)
			.addButton((button) => button.setButtonText('恢复当前模式默认值').onClick(() => {
				this.value[this.activeMode] = [...DEFAULT_PROJECT_VIEW_DISPLAY[this.activeMode]];
				this.dirtyModes.add(this.activeMode);
				this.render();
			}))
			.addButton((button) => button.setButtonText('保存当前模式').setCta().onClick(() => {
				const mode = this.activeMode;
				const next = normalizeProjectViewDisplay({
					...this.manager.projectViewDisplay,
					[mode]: [...this.value[mode]],
				}, this.customFields());
				void this.manager.saveProjectViewDisplay(next)
					.then(() => {
						this.value[mode] = [...this.manager.projectViewDisplay[mode]];
						this.dirtyModes.delete(mode);
						new Notice(`${MODE_LABELS[mode]}显示规则已保存。`);
						this.render();
					})
					.catch((error: unknown) => new Notice(error instanceof Error ? error.message : String(error)));
			}));
	}
}
