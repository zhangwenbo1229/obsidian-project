import { Notice, Setting } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import {
	DEFAULT_PROJECT_VIEW_DISPLAY,
	normalizeProjectViewDisplay,
	type ProjectViewDisplaySettings,
	type ProjectViewMode,
} from '../views/task-display-settings';
import { SortableDisplayFields } from './sortable-display-fields';
import { taskFieldOptions } from './task-field-configuration';

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
		this.value = normalizeProjectViewDisplay(manager.projectViewDisplay, this.customFields(), this.workflowStatuses());
	}

	private customFields() {
		return [...new Map(this.manager.projects.flatMap((project) => project.customFields).map((field) => [field.key, field])).values()];
	}

	private workflowStatuses() {
		return [...new Map(this.manager.projects.flatMap((project) => project.workflow.statuses).map((status) => [status.id, status])).values()];
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
		this.renderBehaviorSettings(panel);
		new Setting(panel)
			.addButton((button) => button.setButtonText('恢复当前模式默认值').onClick(() => {
				this.value[this.activeMode] = [...DEFAULT_PROJECT_VIEW_DISPLAY[this.activeMode]];
				if (this.activeMode !== 'list') this.value.behavior[this.activeMode] = structuredClone(DEFAULT_PROJECT_VIEW_DISPLAY.behavior[this.activeMode]) as never;
				this.dirtyModes.add(this.activeMode);
				this.render();
			}))
			.addButton((button) => button.setButtonText('保存当前模式').setCta().onClick(() => {
				const mode = this.activeMode;
				const next = normalizeProjectViewDisplay({
					...this.value,
					[mode]: [...this.value[mode]],
				}, this.customFields(), this.workflowStatuses());
				void this.manager.saveProjectViewDisplay(next)
					.then(() => {
						this.value = normalizeProjectViewDisplay(this.manager.projectViewDisplay, this.customFields(), this.workflowStatuses());
						this.dirtyModes.delete(mode);
						new Notice(`${MODE_LABELS[mode]}显示规则已保存。`);
						this.render();
					})
					.catch((error: unknown) => new Notice(error instanceof Error ? error.message : String(error)));
			}));
	}

	private renderBehaviorSettings(panel: HTMLElement): void {
		if (this.activeMode === 'list') return;
		const markDirty = () => this.dirtyModes.add(this.activeMode);
		if (this.activeMode === 'board') {
			new Setting(panel).setName('状态分组').setDesc('指定每个工作流状态显示在哪个看板组中。').setHeading();
			const statuses = [...new Map(this.manager.projects.flatMap((project) => project.workflow.statuses)
				.map((status) => [status.id, status])).values()];
			for (const status of statuses) {
				const groups = this.value.behavior.board.groupStatusIds;
				const current = (['todo', 'in_progress', 'done'] as const).find((category) => groups[category].includes(status.id)) ?? status.category;
				new Setting(panel).setName(status.name).setDesc(status.id).addDropdown((dropdown) => dropdown
					.addOption('todo', '未开始')
					.addOption('in_progress', '处理中')
					.addOption('done', '已完成')
					.setValue(current)
					.onChange((category) => {
						for (const key of ['todo', 'in_progress', 'done'] as const) groups[key] = groups[key].filter((id) => id !== status.id);
						groups[category as keyof typeof groups].push(status.id);
						markDirty();
					}));
			}
			new Setting(panel).setName('显示已完成列').addToggle((toggle) => toggle
				.setValue(this.value.behavior.board.showCompletedColumn)
				.onChange((showCompletedColumn) => { this.value.behavior.board.showCompletedColumn = showCompletedColumn; markDirty(); }));
			new Setting(panel).setName('拖拽时自动调整工作流状态').addToggle((toggle) => toggle
				.setValue(this.value.behavior.board.autoUpdateStatusOnDrop)
				.onChange((autoUpdateStatusOnDrop) => { this.value.behavior.board.autoUpdateStatusOnDrop = autoUpdateStatusOnDrop; markDirty(); }));
			return;
		}
		if (this.activeMode === 'calendar') {
			new Setting(panel).setName('日历日期来源').setDesc('区间模式保留跨日期卡片；单日期模式只显示所选日期。').addDropdown((dropdown) => dropdown
				.addOption('planned-range', '计划 → 截止区间')
				.addOption('execution-range', '开始 → 结束区间')
				.addOption('scheduledDate', '计划日期')
				.addOption('dueDate', '截止日期')
				.addOption('startDate', '开始日期')
				.addOption('endDate', '结束日期')
				.setValue(this.value.behavior.calendar.dateSource)
				.onChange((dateSource) => { this.value.behavior.calendar.dateSource = dateSource as typeof this.value.behavior.calendar.dateSource; markDirty(); }));
			new Setting(panel).setName('拖拽时自动写入日期').setDesc('拖到日期格后更新所选日期；区间模式会平移整个区间。').addToggle((toggle) => toggle
				.setValue(this.value.behavior.calendar.autoUpdateDateOnDrop)
				.onChange((autoUpdateDateOnDrop) => { this.value.behavior.calendar.autoUpdateDateOnDrop = autoUpdateDateOnDrop; markDirty(); }));
			return;
		}
		const prioritySetting = new Setting(panel).setName('重要优先级').setDesc('可同时选择多个优先级。');
		const picker = prioritySetting.controlEl.createEl('details', { cls: 'op-priority-multi-select op-multi-select' });
		const priorityOptions = [...new Map([
			...this.value.behavior.quadrants.importantPriorities.map((id) => ({ id, name: id })),
			...this.manager.taskTemplates.flatMap((template) => taskFieldOptions(template.taskTypes[0], 'priority')),
			...this.manager.projects.flatMap((project) => project.taskTypes.flatMap((type) => taskFieldOptions(type, 'priority'))),
		].map((option) => [option.id, option])).values()];
		const priorityLabels = new Map(priorityOptions.map((option) => [option.id, option.name]));
		const summary = picker.createEl('summary');
		const updateSummary = () => summary.setText(this.value.behavior.quadrants.importantPriorities
			.map((priority) => priorityLabels.get(priority) ?? priority).join('、') || '未选择');
		updateSummary();
		const options = picker.createDiv({ cls: 'op-multi-select-options' });
		for (const priorityOption of priorityOptions) {
			const priority = priorityOption.id;
			const option = options.createEl('label', { cls: 'op-multi-select-option' });
			const checkbox = option.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.value.behavior.quadrants.importantPriorities.includes(priority);
			option.createSpan({ text: `${priorityOption.name}优先级` });
			checkbox.addEventListener('change', () => {
				const current = this.value.behavior.quadrants.importantPriorities.filter((item) => item !== priority);
				this.value.behavior.quadrants.importantPriorities = checkbox.checked ? [...current, priority] : current;
				markDirty();
				updateSummary();
			});
		}
		new Setting(panel).setName('紧急期限').setDesc('截止日期在指定天数内（含逾期）时视为紧急。').addSlider((slider) => slider
			.setLimits(0, 365, 1).setDynamicTooltip().setValue(this.value.behavior.quadrants.urgentWithinDays)
			.onChange((urgentWithinDays) => { this.value.behavior.quadrants.urgentWithinDays = urgentWithinDays; markDirty(); }));
	}
}
