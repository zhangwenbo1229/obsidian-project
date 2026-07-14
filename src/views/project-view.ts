import { ItemView, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { IndexedTask } from '../index/task-index';
import { EditTaskModal } from '../modals/edit-task-modal';
import { activeProjectFilterCount, ALL_PROJECTS_UID, calendarItems, classifyTaskQuadrants, filterProjectTasks, type ProjectFilters, type TaskQuadrant } from './selectors';
import { transitionTask } from '../domain/workflow';
import type { ProjectConfig, TaskDisplayField } from '../domain/types';
import { displayDateTime, localDate, localDateTime } from '../utils/dates';
import { PROJECT_FILTER_FIELD_DEFINITIONS, ProjectFilterFields, projectFilterFieldDefinition, type ProjectFilterField } from './project-filter-fields';
import { restoreProjectFilter, serializeProjectFilter, validateSavedFilterName } from './saved-project-filters';
import { createUuid } from '../utils/ids';
import { resizeColumnWidth, totalColumnWidth } from './column-widths';
import { toggleMultiValue } from './multi-select-filter';
import { renderTaskMarker, renderTaskTitle } from './task-type-presentation';
import { renderTaskCardFields, renderTaskMarkdownValue } from './task-card-fields';
import { bindTaskCardActivation, isInteractiveTaskCardTarget } from './task-card-interaction';
import { renderTags } from './tag-presentation';
import { renderTaskRelations } from './task-relation-presentation';
import { formatCustomFieldValue } from './custom-field-presentation';
import { calendarMonthCells, calendarRangeTitle, calendarWeekDates, moveCalendarCursor } from './calendar-range';

export const PROJECT_VIEW_TYPE = 'obsidian-project-project';
type Mode = 'list' | 'board' | 'calendar' | 'quadrants';

export class ProjectView extends ItemView {
	private projectUid = ALL_PROJECTS_UID;
	private keyword = '';
	private mode: Mode = 'list';
	private statusIds = new Set<string>();
	private taskTypeIds = new Set<string>();
	private reporterIds = new Set<string>();
	private assigneeIds = new Set<string>();
	private tags = new Set<string>();
	private dueDateFrom = '';
	private dueDateTo = '';
	private createdAtFrom = '';
	private createdAtTo = '';
	private startDateFrom = '';
	private startDateTo = '';
	private completedAtFrom = '';
	private completedAtTo = '';
	private statusCategories = new Set<string>();
	private customFilters: Record<string, Set<unknown>> = {};
	private hasIncompleteSubtasks = false;
	private columnWidths: Record<string, number> = {
		key: 110, title: 260, project: 130, type: 110, status: 110, priority: 90, reporter: 120,
		assignee: 120, startDate: 150, dueDate: 150, tags: 180, relations: 220, links: 240, subtasks: 260,
	};
	private sortColumn = 'key';
	private sortAscending = true;
	private calendarCursor = new Date();
	private calendarMode: 'month' | 'week' = 'month';
	private filtersOpen = false;
	private saveFilterOpen = false;
	private saveFilterName = '';
	private selectedSavedFilterId = '';
	private openFilterControlId = '';
	private readonly filterFields = new ProjectFilterFields();
	constructor(leaf: WorkspaceLeaf, private readonly manager: ProjectManager) { super(leaf); }
	getViewType(): string { return PROJECT_VIEW_TYPE; }
	getDisplayText(): string { return '项目视图'; }
	getIcon(): string { return 'panels-top-left'; }
	async onOpen(): Promise<void> {
		this.register(this.manager.onChange(() => this.render()));
		this.render();
	}
	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty(); container.addClass('op-view', 'op-project-view');
		const project = this.manager.projects.find((item) => item.uid === this.projectUid);
		const allProjects = this.projectUid === ALL_PROJECTS_UID;
		const scopedTasks = this.manager.index.validTasks().filter((task) => allProjects || task.project.uid === this.projectUid);
		const hero = container.createDiv({ cls: 'op-view-hero op-project-hero' });
		const heroCopy = hero.createDiv();
		heroCopy.createDiv({ cls: 'op-eyebrow', text: 'PROJECT SPACE / 项目空间' });
		heroCopy.createEl('h2', { text: allProjects ? '全部项目' : project?.name ?? '选择项目' });
		heroCopy.createEl('p', { text: allProjects ? `${this.manager.projects.length} 个项目 · ${scopedTasks.length} 个任务` : project ? `${project.code} · ${scopedTasks.length} 个任务` : '从项目开始组织工作。' });
		const select = hero.createEl('select', { cls: 'op-project-picker' });
		select.createEl('option', { value: ALL_PROJECTS_UID, text: '全部项目' });
		for (const project of this.manager.projects) select.createEl('option', { value: project.uid, text: `${project.code} · ${project.name}` });
		select.value = this.projectUid;
		select.addEventListener('change', () => { this.projectUid = select.value; this.render(); });
		const toolbar = container.createDiv({ cls: 'op-project-toolbar' });
		const searchShell = toolbar.createDiv({ cls: 'op-search-shell' });
		const searchIcon = searchShell.createSpan({ cls: 'op-search-icon' });
		setIcon(searchIcon, 'search');
		const search = searchShell.createEl('input', { type: 'search', placeholder: '搜索任务，或组合状态、人员、标签和日期条件' });
		search.value = this.keyword;
		const filterTriggerWrap = searchShell.createDiv({ cls: 'op-filter-trigger-wrap' });
		const filterButton = filterTriggerWrap.createEl('button', { cls: 'op-filter-trigger', text: '添加筛选' });
		const filterBadge = filterButton.createSpan({ cls: 'op-filter-count' });
		filterBadge.setText(String(activeProjectFilterCount(this.currentFilters())));
		filterButton.addEventListener('click', () => { this.filtersOpen = !this.filtersOpen; this.render(); });
		if (this.filtersOpen) this.renderFilterPicker(filterTriggerWrap);
		const clearButton = searchShell.createEl('button', { cls: 'op-clear-filters', text: '清除' });
		clearButton.toggleClass('is-hidden', activeProjectFilterCount(this.currentFilters()) === 0);
		clearButton.addEventListener('click', () => { this.clearFilters(); this.render(); });
		search.addEventListener('input', () => {
			this.keyword = search.value;
			filterBadge.setText(String(activeProjectFilterCount(this.currentFilters())));
			clearButton.toggleClass('is-hidden', activeProjectFilterCount(this.currentFilters()) === 0);
			this.renderContent(container);
		});
		const savedSelect = searchShell.createEl('select', { cls: 'op-saved-filter-select', attr: { 'aria-label': '已保存的筛选器' } });
		savedSelect.createEl('option', { value: '', text: '已保存的筛选器' });
		for (const preset of this.manager.savedProjectFilters.filter((item) => !item.projectUid || item.projectUid === this.projectUid)) {
			savedSelect.createEl('option', { value: preset.id, text: preset.name });
		}
		savedSelect.value = this.selectedSavedFilterId;
		savedSelect.addEventListener('change', () => {
			this.selectedSavedFilterId = savedSelect.value;
			const preset = this.manager.savedProjectFilters.find((item) => item.id === savedSelect.value);
			if (preset) this.applySavedFilter(preset.filters);
			this.render();
		});
		const saveFilterButton = searchShell.createEl('button', { cls: 'op-filter-icon-button', attr: { 'aria-label': '保存当前筛选器', title: '保存当前筛选器' } });
		setIcon(saveFilterButton, 'save');
		saveFilterButton.addEventListener('click', () => { this.saveFilterOpen = !this.saveFilterOpen; this.render(); });
		if (this.selectedSavedFilterId) {
			const updateButton = searchShell.createEl('button', { cls: 'op-filter-icon-button', attr: { 'aria-label': '覆盖已保存筛选器', title: '覆盖已保存筛选器' } });
			setIcon(updateButton, 'refresh-cw');
			updateButton.addEventListener('click', () => void this.updateSavedFilter());
			const deleteButton = searchShell.createEl('button', { cls: 'op-filter-icon-button is-danger', attr: { 'aria-label': '删除已保存筛选器', title: '删除已保存筛选器' } });
			setIcon(deleteButton, 'trash-2');
			deleteButton.addEventListener('click', () => void this.deleteSavedFilter());
		}
		const switcher = toolbar.createDiv({ cls: 'op-view-switch' });
		for (const mode of ['list', 'board', 'calendar', 'quadrants'] as const) {
			const labels = { list: '列表', board: '看板', calendar: '日历', quadrants: '四象限' };
			const button = switcher.createEl('button', { text: labels[mode] });
			button.toggleClass('mod-cta', this.mode === mode);
			button.addEventListener('click', () => { this.mode = mode; this.render(); });
		}
		const chips = this.filterLabels(project);
		if (chips.length > 0) {
			const chipRow = container.createDiv({ cls: 'op-active-filters' });
			for (const label of chips) chipRow.createSpan({ cls: 'op-filter-chip', text: label });
		}
		if (this.saveFilterOpen) this.renderSaveFilter(container);
		if (this.filterFields.selected().length > 0) this.renderFilters(container);
		this.renderContent(container);
	}

	private renderSaveFilter(container: HTMLElement): void {
		const panel = container.createDiv({ cls: 'op-save-filter-panel' });
		panel.createEl('strong', { text: '保存筛选器' });
		const input = panel.createEl('input', { type: 'text', placeholder: '例如：本周待处理缺陷' });
		input.value = this.saveFilterName;
		input.addEventListener('input', () => (this.saveFilterName = input.value));
		const save = panel.createEl('button', { cls: 'mod-cta', text: '保存' });
		save.addEventListener('click', () => void this.saveCurrentFilter());
		const cancel = panel.createEl('button', { text: '取消' });
		cancel.addEventListener('click', () => { this.saveFilterOpen = false; this.render(); });
	}

	private async saveCurrentFilter(): Promise<void> {
		try {
			const name = validateSavedFilterName(this.saveFilterName);
			const timestamp = localDateTime();
			const id = createUuid();
			await this.manager.saveProjectFilter({
				id, name, projectUid: this.projectUid === ALL_PROJECTS_UID ? null : this.projectUid, filters: serializeProjectFilter(this.currentFilters()),
				createdAt: timestamp, updatedAt: timestamp,
			});
			this.selectedSavedFilterId = id;
			this.saveFilterName = '';
			this.saveFilterOpen = false;
			new Notice('筛选器已保存。');
			this.render();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async updateSavedFilter(): Promise<void> {
		const preset = this.manager.savedProjectFilters.find((item) => item.id === this.selectedSavedFilterId);
		if (!preset) return;
		await this.manager.saveProjectFilter({
			...preset,
			filters: serializeProjectFilter(this.currentFilters()),
			updatedAt: localDateTime(),
		});
		new Notice('筛选器已更新。');
	}

	private async deleteSavedFilter(): Promise<void> {
		if (!this.selectedSavedFilterId) return;
		await this.manager.deleteProjectFilter(this.selectedSavedFilterId);
		this.selectedSavedFilterId = '';
		new Notice('筛选器已删除。');
		this.render();
	}

	private applySavedFilter(saved: ReturnType<typeof serializeProjectFilter>): void {
		const restored = restoreProjectFilter({ ...saved, projectUid: this.projectUid });
		this.keyword = restored.keyword ?? '';
		this.statusIds = new Set(restored.statusIds);
		this.statusCategories = new Set(restored.statusCategories);
		this.taskTypeIds = new Set(restored.taskTypeIds);
		this.reporterIds = new Set(restored.reporterIds);
		this.assigneeIds = new Set(restored.assigneeIds);
		this.tags = new Set(restored.tags);
		this.createdAtFrom = restored.createdAtFrom ?? '';
		this.createdAtTo = restored.createdAtTo ?? '';
		this.startDateFrom = restored.startDateFrom ?? '';
		this.startDateTo = restored.startDateTo ?? '';
		this.dueDateFrom = restored.dueDateFrom ?? '';
		this.dueDateTo = restored.dueDateTo ?? '';
		this.completedAtFrom = restored.completedAtFrom ?? '';
		this.completedAtTo = restored.completedAtTo ?? '';
		this.hasIncompleteSubtasks = restored.hasIncompleteSubtasks ?? false;
		this.customFilters = Object.fromEntries(
			Object.entries(restored.customFields ?? {}).map(([key, values]) => [key, new Set(values)]),
		);
		this.filterFields.clear();
		const active: ProjectFilterField[] = [];
		if (this.statusIds.size) active.push('status');
		if (this.statusCategories.size) active.push('statusCategory');
		if (this.taskTypeIds.size) active.push('type');
		if (this.reporterIds.size) active.push('reporter');
		if (this.assigneeIds.size) active.push('assignee');
		if (this.tags.size) active.push('tags');
		if (this.createdAtFrom || this.createdAtTo) active.push('createdAt');
		if (this.startDateFrom || this.startDateTo) active.push('startDate');
		if (this.dueDateFrom || this.dueDateTo) active.push('dueDate');
		if (this.completedAtFrom || this.completedAtTo) active.push('completedAt');
		if (this.hasIncompleteSubtasks) active.push('subtasks');
		if (Object.keys(this.customFilters).length) active.push('customFields');
		for (const field of active) this.filterFields.toggle(field);
	}

	private renderFilterPicker(container: HTMLElement): void {
		const picker = container.createDiv({ cls: 'op-filter-field-picker' });
		picker.createDiv({ cls: 'op-eyebrow', text: '选择筛选条件' });
		const options = picker.createDiv({ cls: 'op-filter-field-options' });
		for (const definition of PROJECT_FILTER_FIELD_DEFINITIONS) {
			const field = definition.field;
			const label = options.createEl('label', { cls: 'op-filter-field-option' });
			const checkbox = label.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.filterFields.has(field);
			checkbox.addEventListener('change', () => {
				this.filterFields.toggle(field);
				this.render();
			});
			label.createSpan({ text: definition.pickerLabel });
		}
	}
	private currentFilters(): ProjectFilters {
		return {
			projectUid: this.projectUid,
			keyword: this.keyword,
			statusIds: this.statusIds,
			statusCategories: this.statusCategories,
			taskTypeIds: this.taskTypeIds,
			reporterIds: this.reporterIds,
			assigneeIds: this.assigneeIds,
			tags: this.tags,
			dueDateFrom: this.dueDateFrom || undefined,
			dueDateTo: this.dueDateTo || undefined,
			createdAtFrom: this.createdAtFrom || undefined,
			createdAtTo: this.createdAtTo || undefined,
			startDateFrom: this.startDateFrom || undefined,
			startDateTo: this.startDateTo || undefined,
			completedAtFrom: this.completedAtFrom || undefined,
			completedAtTo: this.completedAtTo || undefined,
			hasIncompleteSubtasks: this.hasIncompleteSubtasks || undefined,
			customFields: this.customFilters,
		};
	}
	private clearFilters(): void {
		this.keyword = '';
		for (const selected of [this.statusIds, this.statusCategories, this.taskTypeIds, this.reporterIds, this.assigneeIds, this.tags]) selected.clear();
		this.createdAtFrom = ''; this.createdAtTo = '';
		this.startDateFrom = ''; this.startDateTo = '';
		this.dueDateFrom = ''; this.dueDateTo = '';
		this.completedAtFrom = ''; this.completedAtTo = '';
		this.hasIncompleteSubtasks = false;
		this.customFilters = {};
	}
	private removeFilterField(field: ProjectFilterField): void {
		if (field === 'status') this.statusIds.clear();
		else if (field === 'statusCategory') this.statusCategories.clear();
		else if (field === 'type') this.taskTypeIds.clear();
		else if (field === 'reporter') this.reporterIds.clear();
		else if (field === 'assignee') this.assigneeIds.clear();
		else if (field === 'tags') this.tags.clear();
		else if (field === 'createdAt') { this.createdAtFrom = ''; this.createdAtTo = ''; }
		else if (field === 'startDate') { this.startDateFrom = ''; this.startDateTo = ''; }
		else if (field === 'dueDate') { this.dueDateFrom = ''; this.dueDateTo = ''; }
		else if (field === 'completedAt') { this.completedAtFrom = ''; this.completedAtTo = ''; }
		else if (field === 'subtasks') this.hasIncompleteSubtasks = false;
		else if (field === 'customFields') this.customFilters = {};
		this.filterFields.remove(field);
		this.openFilterControlId = '';
		this.render();
	}
	private addFilterRemoveButton(parent: HTMLElement, field: ProjectFilterField, label: string): void {
		const button = parent.createEl('button', {
			cls: 'op-filter-remove',
			attr: { type: 'button', title: `删除${label}筛选条件`, 'aria-label': `删除${label}筛选条件` },
		});
		setIcon(button, 'x');
		button.addEventListener('click', () => this.removeFilterField(field));
	}
	private filterLabels(project: ProjectConfig | undefined): string[] {
		const labels: string[] = [];
		const names = (ids: ReadonlySet<string>, values: Array<{ id: string; name: string }>, prefix: string) => {
			if (ids.size > 0) labels.push(`${prefix}：${[...ids].map((id) => values.find((item) => item.id === id)?.name ?? id).join('、')}`);
		};
		names(this.statusIds, project?.workflow.statuses ?? [], '状态');
		names(this.taskTypeIds, project?.taskTypes ?? [], '类型');
		names(this.reporterIds, this.manager.globalConfig.people, '提报人');
		names(this.assigneeIds, this.manager.globalConfig.people, '经办人');
		if (this.statusCategories.size > 0) labels.push(`分类：${[...this.statusCategories].join('、')}`);
		if (this.tags.size > 0) labels.push(`标签：${[...this.tags].join('、')}`);
		if (this.hasIncompleteSubtasks) labels.push('子任务：包含未完成项');
		for (const [label, from, to] of [
			['创建日期', this.createdAtFrom, this.createdAtTo],
			['开始日期', this.startDateFrom, this.startDateTo],
			['计划完成', this.dueDateFrom, this.dueDateTo],
			['完成日期', this.completedAtFrom, this.completedAtTo],
		]) {
			if (from || to) labels.push(`${label}：${from || '…'} → ${to || '…'}`);
		}
		for (const [key, values] of Object.entries(this.customFilters)) {
			if (values.size === 0) continue;
			const name = project?.customFields.find((field) => field.key === key)?.name ?? key;
			labels.push(`${name}：${[...values].join('、')}`);
		}
		return labels;
	}
	private renderFilters(container: HTMLElement): void {
		const projects = this.scopedProjects();
		const uniqueOptions = (values: Array<{ value: string; label: string }>) => [
			...new Map(values.map((item) => [item.value, item])).values(),
		];
		const filters = container.createDiv({ cls: 'op-filter-panel' });
		const addMulti = (field: ProjectFilterField, values: Array<{ value: string; label: string }>, selected: Set<string>, labelOverride?: string, controlSuffix = '') => {
			if (!this.filterFields.has(field)) return;
			const controlId = `${field}:${controlSuffix || labelOverride || field}`;
			const wrapper = filters.createDiv({ cls: 'op-filter-field' });
			wrapper.dataset.filterField = field;
			const label = labelOverride ?? projectFilterFieldDefinition(field).controlLabel;
			this.addFilterRemoveButton(wrapper, field, label);
			const details = wrapper.createEl('details', { cls: 'op-multi-select' });
			details.open = this.openFilterControlId === controlId;
			details.addEventListener('toggle', () => {
				if (details.open) this.openFilterControlId = controlId;
				else if (this.openFilterControlId === controlId) this.openFilterControlId = '';
			});
			details.createEl('summary', { text: `${label}${selected.size > 0 ? ` (${selected.size})` : ''}` });
			const options = details.createDiv({ cls: 'op-multi-select-options' });
			for (const item of values) {
				const option = options.createEl('label', { cls: 'op-multi-select-option' });
				const checkbox = option.createEl('input', { type: 'checkbox' });
				checkbox.checked = selected.has(item.value);
				checkbox.addEventListener('change', () => {
					this.openFilterControlId = controlId;
					const next = toggleMultiValue(selected, item.value, checkbox.checked);
					selected.clear();
					for (const value of next) selected.add(value);
					this.render();
				});
				option.createSpan({ text: item.label });
			}
		};
		addMulti('status', uniqueOptions(projects.flatMap((item) => item.workflow.statuses.map((status) => ({ value: status.id, label: status.name })))), this.statusIds);
		addMulti('statusCategory', [{ value: 'todo', label: '未开始' }, { value: 'in_progress', label: '处理中' }, { value: 'done', label: '已结束' }], this.statusCategories);
		addMulti('type', uniqueOptions(projects.flatMap((item) => item.taskTypes.map((type) => ({ value: type.id, label: type.name })))), this.taskTypeIds);
		addMulti('reporter', this.manager.globalConfig.people.map((item) => ({ value: item.id, label: item.name })), this.reporterIds);
		addMulti('assignee', this.manager.globalConfig.people.map((item) => ({ value: item.id, label: item.name })), this.assigneeIds);
		const projectUids = new Set(projects.map((item) => item.uid));
		const allTags = [...new Set(this.manager.index.validTasks().filter((task) => projectUids.has(task.project.uid)).flatMap((task) => task.document.metadata.tags))];
		addMulti('tags', allTags.map((tag) => ({ value: tag, label: tag })), this.tags);
		if (this.filterFields.has('subtasks')) {
			const wrapper = filters.createDiv({ cls: 'op-filter-field op-filter-boolean-field' });
			wrapper.dataset.filterField = 'subtasks';
			this.addFilterRemoveButton(wrapper, 'subtasks', projectFilterFieldDefinition('subtasks').controlLabel);
			const label = wrapper.createEl('label', { cls: 'op-filter-toggle' });
			const checkbox = label.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.hasIncompleteSubtasks;
			checkbox.addEventListener('change', () => {
				this.hasIncompleteSubtasks = checkbox.checked;
				this.render();
			});
			label.createSpan({ text: projectFilterFieldDefinition('subtasks').controlLabel });
		}
		for (const range of [
			{ field: 'createdAt', from: this.createdAtFrom, to: this.createdAtTo, setFrom: (value: string) => (this.createdAtFrom = value), setTo: (value: string) => (this.createdAtTo = value) },
			{ field: 'startDate', from: this.startDateFrom, to: this.startDateTo, setFrom: (value: string) => (this.startDateFrom = value), setTo: (value: string) => (this.startDateTo = value) },
			{ field: 'dueDate', from: this.dueDateFrom, to: this.dueDateTo, setFrom: (value: string) => (this.dueDateFrom = value), setTo: (value: string) => (this.dueDateTo = value) },
			{ field: 'completedAt', from: this.completedAtFrom, to: this.completedAtTo, setFrom: (value: string) => (this.completedAtFrom = value), setTo: (value: string) => (this.completedAtTo = value) },
		] satisfies Array<{ field: ProjectFilterField; from: string; to: string; setFrom(value: string): void; setTo(value: string): void }>) {
			if (!this.filterFields.has(range.field)) continue;
			const wrapper = filters.createDiv({ cls: 'op-filter-field op-filter-date-field' });
			wrapper.dataset.filterField = range.field;
			const label = projectFilterFieldDefinition(range.field).controlLabel;
			this.addFilterRemoveButton(wrapper, range.field, label);
			wrapper.createEl('label', { text: label });
			const controls = wrapper.createDiv({ cls: 'op-filter-date-range' });
			const from = controls.createEl('input', { type: 'date', attr: { 'aria-label': '开始日期' } });
			from.value = range.from;
			controls.createSpan({ text: '至' });
			const to = controls.createEl('input', { type: 'date', attr: { 'aria-label': '结束日期' } });
			to.value = range.to;
			from.addEventListener('change', () => { range.setFrom(from.value); this.render(); });
			to.addEventListener('change', () => { range.setTo(to.value); this.render(); });
		}
		const customFields = [...new Map(projects.flatMap((item) => item.customFields).map((field) => [field.key, field])).values()];
		for (const field of this.filterFields.has('customFields') ? customFields.filter((item) => item.type === 'single-select' || item.type === 'multi-select') : []) {
			const selected = this.customFilters[field.key] ??= new Set();
			addMulti('customFields', (field.options ?? []).map((option) => ({ value: option.id, label: option.name })), selected as Set<string>, field.name, field.key);
		}
		for (const field of this.filterFields.has('customFields') ? customFields.filter((item) => item.type !== 'single-select' && item.type !== 'multi-select') : []) {
			const wrapper = filters.createDiv({ cls: 'op-filter-field' });
			wrapper.dataset.filterField = `customFields:${field.key}`;
			this.addFilterRemoveButton(wrapper, 'customFields', field.name);
			wrapper.createEl('label', { text: field.name });
			const input = wrapper.createEl('input', { type: field.type === 'date' ? 'date' : 'text' });
			const current = [...(this.customFilters[field.key] ?? new Set())][0];
			input.value = typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean' ? String(current) : '';
			input.addEventListener('change', () => {
				if (!input.value) delete this.customFilters[field.key];
				else this.customFilters[field.key] = new Set([field.type === 'number' ? Number(input.value) : field.type === 'boolean' ? input.value === 'true' : input.value]);
				this.render();
			});
		}
	}
	private renderContent(container: HTMLElement): void {
		container.querySelector('.op-project-content')?.remove();
		const content = container.createDiv({ cls: 'op-project-content' });
		const tasks = filterProjectTasks(this.manager.index.validTasks(), this.currentFilters());
		const results = content.createDiv({ cls: 'op-results-bar' });
		results.createEl('strong', { text: `${tasks.length} 个任务` });
		results.createSpan({ text: this.mode === 'board' ? '按工作流状态分组' : this.mode === 'calendar' ? '按开始与计划完成日期展示' : this.mode === 'quadrants' ? '高优先级为重要，3 天内到期为紧急' : '点击表头可临时排序' });
		const surface = content.createDiv({ cls: 'op-mode-surface' });
		if (this.mode === 'board') this.renderBoard(surface, tasks);
		else if (this.mode === 'calendar') this.renderCalendar(surface, tasks);
		else if (this.mode === 'quadrants') this.renderQuadrants(surface, tasks);
		else this.renderList(surface, tasks);
	}

	private renderQuadrants(parent: HTMLElement, tasks: ReturnType<typeof filterProjectTasks>): void {
		const fields = this.displayFields('quadrants');
		const quadrants = classifyTaskQuadrants(tasks, localDate());
		const grid = parent.createDiv({ cls: 'op-quadrant-grid' });
		const definitions: Array<[TaskQuadrant, string, string]> = [
			['importantUrgent', '重要且紧急', '立即处理'],
			['importantNotUrgent', '重要不紧急', '安排计划'],
			['notImportantUrgent', '不重要但紧急', '快速处理或委派'],
			['notImportantNotUrgent', '不重要不紧急', '稍后评估'],
		];
		for (const [key, title, description] of definitions) {
			const region = grid.createDiv({ cls: `op-quadrant-region is-${key}` });
			const heading = region.createDiv({ cls: 'op-quadrant-heading' });
			const copy = heading.createDiv();
			copy.createEl('h3', { text: title });
			copy.createEl('p', { text: description });
			heading.createSpan({ cls: 'op-count-pill', text: String(quadrants[key].length) });
			this.renderQuadrantCards(region, quadrants[key], fields);
		}
	}

	private renderQuadrantCards(parent: HTMLElement, tasks: IndexedTask[], fields: readonly TaskDisplayField[]): void {
		const list = parent.createDiv({ cls: 'op-quadrant-card-list' });
		if (tasks.length === 0) {
			list.createDiv({ cls: 'op-empty-state', text: '暂无任务' });
			return;
		}
		for (const task of tasks) {
			const card = list.createDiv({ cls: 'op-quadrant-card', attr: { role: 'button', tabindex: '0', 'aria-label': task.document.metadata.title } });
			renderTaskCardFields(card, task, this.manager, fields, {
				titleClassName: 'op-quadrant-card-title', component: this, markerBeforeKey: true, priorityInCorner: true,
			});
			bindTaskCardActivation(card, () => new EditTaskModal(this.manager, task).open());
		}
	}
	private taskButton(parent: HTMLElement, task: IndexedTask): void {
		const button = parent.createEl('button', { cls: 'op-task-row' });
		const taskType = task.project.taskTypes.find((type) => type.id === task.document.metadata.taskTypeId);
		renderTaskTitle(button, taskType, task.document.metadata.title, { taskKey: task.document.metadata.key });
		button.addEventListener('click', () => new EditTaskModal(this.manager, task).open());
	}
	private renderList(parent: HTMLElement, tasks: ReturnType<typeof filterProjectTasks>): void {
		parent.addClass('op-list-scroll');
		const fields = this.displayFields('list');
		const columns = this.columnDefinitions(fields);
		const sorted = [...tasks].sort((left, right) => {
			const result = this.columnValue(left, this.sortColumn).localeCompare(this.columnValue(right, this.sortColumn), 'zh-CN');
			return this.sortAscending ? result : -result;
		});
		const table = parent.createEl('table', { cls: 'op-table' });
		const updateTableWidth = () => {
			table.style.width = `${totalColumnWidth(columns.map((column) => this.columnWidths[column.id] ?? 140))}px`;
		};
		updateTableWidth();
		const header = table.createEl('thead').createEl('tr');
		for (const column of columns) {
			const cell = header.createEl('th');
			cell.style.width = `${this.columnWidths[column.id] ?? 140}px`;
			const button = cell.createEl('button', { text: column.name });
			button.addEventListener('click', () => { this.sortAscending = this.sortColumn === column.id ? !this.sortAscending : true; this.sortColumn = column.id; this.render(); });
			const handle = cell.createSpan({ cls: 'op-column-resize-handle' });
			handle.addEventListener('pointerdown', (event) => {
				event.preventDefault();
				event.stopPropagation();
				const startX = event.clientX;
				const startWidth = this.columnWidths[column.id] ?? cell.getBoundingClientRect().width;
				handle.setPointerCapture(event.pointerId);
				const move = (moveEvent: PointerEvent) => {
					const width = resizeColumnWidth(startWidth, moveEvent.clientX - startX);
					cell.style.width = `${width}px`;
					this.columnWidths[column.id] = width;
					updateTableWidth();
				};
				handle.addEventListener('pointermove', move);
				handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', move), { once: true });
			});
		}
		const body = table.createEl('tbody');
		let rendered = 0;
		const appendChunk = () => {
			for (const task of sorted.slice(rendered, rendered + 100)) {
				const row = body.createEl('tr');
				for (const column of columns) {
					const cell = row.createEl('td');
					cell.style.width = `${this.columnWidths[column.id] ?? 140}px`;
					if (column.id === 'key') {
						const key = cell.createSpan({ cls: 'op-task-key-cell' });
						const taskType = task.project.taskTypes.find((type) => type.id === task.document.metadata.taskTypeId);
						renderTaskMarker(key, taskType);
						key.createSpan({ text: task.document.metadata.key });
					} else if (column.id === 'title') {
						const taskType = task.project.taskTypes.find((type) => type.id === task.document.metadata.taskTypeId);
						renderTaskTitle(cell, taskType, task.document.metadata.title, { tagName: 'span', showMarker: false });
					} else if (column.id === 'tags') {
						renderTags(cell, task.document.metadata.tags, this.manager);
					} else if (column.id === 'links') {
						renderTaskMarkdownValue(cell, task.document.unknownLinks.join('\n\n'), task, this.manager, this);
					} else if (column.id === 'subtasks') {
						renderTaskMarkdownValue(cell, task.document.subtasks ?? '', task, this.manager, this);
					} else if (column.id === 'relations') {
						renderTaskRelations(cell, task, this.manager);
					} else {
						cell.setText(this.columnValue(task, column.id));
					}
				}
				row.addEventListener('click', (event) => {
					if (!isInteractiveTaskCardTarget(event.target)) new EditTaskModal(this.manager, task).open();
				});
			}
			rendered = Math.min(sorted.length, rendered + 100);
		};
		appendChunk();
		parent.addEventListener('scroll', () => {
			if (parent.scrollTop + parent.clientHeight >= parent.scrollHeight - 80 && rendered < sorted.length) appendChunk();
		});
	}
	private columnDefinitions(fields: readonly TaskDisplayField[]): Array<{ id: string; name: string }> {
		const definitions: Partial<Record<TaskDisplayField, { id: string; name: string }>> = {
			key: { id: 'key', name: 'Key' },
			title: { id: 'title', name: '标题' },
			project: { id: 'project', name: '项目' },
			type: { id: 'type', name: '类型' },
			status: { id: 'status', name: '状态' },
			priority: { id: 'priority', name: '优先级' },
			reporter: { id: 'reporter', name: '提报人' },
			assignee: { id: 'assignee', name: '经办人' },
			startDate: { id: 'startDate', name: '开始日期' },
			dueDate: { id: 'dueDate', name: '计划完成日期' },
			tags: { id: 'tags', name: '标签' },
			relations: { id: 'relations', name: '任务关系' },
			links: { id: 'links', name: '链接' },
			subtasks: { id: 'subtasks', name: '子任务' },
		};
		const customFields = [...new Map(this.scopedProjects().flatMap((item) => item.customFields).map((field) => [field.key, field])).values()];
		return fields.flatMap((field) => {
			if (field === 'customFields') return customFields.map((customField) => ({ id: `custom:${customField.key}`, name: customField.name }));
			if (field.startsWith('custom:')) {
				const customField = customFields.find((item) => item.key === field.slice('custom:'.length));
				return customField ? [{ id: field, name: customField.name }] : [];
			}
			const definition = definitions[field];
			return definition ? [definition] : [];
		});
	}
	private columnValue(task: IndexedTask, column: string): string {
		const metadata = task.document.metadata;
		const person = (id: string | null) => this.manager.globalConfig.people.find((item) => item.id === id)?.name ?? '';
		if (column.startsWith('custom:')) {
			const key = column.slice(7);
			const field = task.project.customFields.find((item) => item.key === key);
			return field ? formatCustomFieldValue(field, metadata.custom[key], this.manager.globalConfig.people) : '';
		}
		return {
			key: metadata.key, title: metadata.title,
			project: task.project.code,
			type: task.project.taskTypes.find((item) => item.id === metadata.taskTypeId)?.name ?? metadata.taskTypeId,
			status: task.project.workflow.statuses.find((item) => item.id === metadata.statusId)?.name ?? metadata.statusId,
			priority: metadata.priority ?? '',
			reporter: person(metadata.reporterId), assignee: person(metadata.assigneeId),
			startDate: displayDateTime(metadata.startDate), dueDate: displayDateTime(metadata.dueDate),
			tags: metadata.tags.map((tag) => `#${tag}`).join(' '),
			relations: task.document.relations.filter((relation) => relation.type === 'related').map((relation) => `${relation.targetKey} · ${relation.targetTitle}`).join('\n'),
			links: task.document.unknownLinks.join('\n'),
			subtasks: task.document.subtasks ?? '',
		}[column] ?? '';
	}
	private renderBoard(parent: HTMLElement, tasks: ReturnType<typeof filterProjectTasks>): void {
		const fields = this.displayFields('board');
		const project = this.manager.projects.find((item) => item.uid === this.projectUid);
		const board = parent.createDiv({ cls: 'op-board' });
		if (this.projectUid === ALL_PROJECTS_UID) {
			for (const [category, name] of [['todo', '未开始'], ['in_progress', '处理中'], ['done', '已结束']] as const) {
				const column = board.createDiv({ cls: 'op-board-column' });
				column.createEl('h4', { text: name });
				for (const task of tasks.filter((item) => item.project.workflow.statuses.find((status) => status.id === item.document.metadata.statusId)?.category === category)) {
					this.renderBoardCard(column, task, false, fields);
				}
			}
			return;
		}
		for (const status of project?.workflow.statuses ?? []) {
			const column = board.createDiv({ cls: 'op-board-column' });
			column.dataset.statusId = status.id;
			column.addEventListener('dragover', (event) => event.preventDefault());
			column.addEventListener('drop', (event) => {
				event.preventDefault();
				const uid = event.dataTransfer?.getData('text/plain');
				const task = uid ? this.manager.index.get(uid) : undefined;
				if (task) void this.moveCard(task, status.id);
			});
			column.createEl('h4', { text: status.name });
			for (const task of tasks.filter((item) => item.document.metadata.statusId === status.id)) {
				this.renderBoardCard(column, task, true, fields);
			}
		}
	}
	private renderBoardCard(parent: HTMLElement, task: IndexedTask, draggable: boolean, fields: readonly TaskDisplayField[]): void {
		const card = parent.createDiv({ cls: 'op-board-card', attr: { role: 'button', tabindex: '0', 'aria-label': task.document.metadata.title } });
		renderTaskCardFields(card, task, this.manager, fields, {
			titleClassName: 'op-board-card-title', component: this, markerBeforeKey: true, priorityInCorner: true, keyTitleInline: true,
		});
		card.draggable = draggable;
		if (draggable) card.addEventListener('dragstart', (event) => event.dataTransfer?.setData('text/plain', task.document.metadata.uid));
		bindTaskCardActivation(card, () => new EditTaskModal(this.manager, task).open());
	}
	private async moveCard(task: IndexedTask, statusId: string): Promise<void> {
		if (task.document.metadata.statusId === statusId) return;
		try {
			const document = structuredClone(task.document);
			document.metadata = transitionTask(document.metadata, task.project.workflow, statusId);
			await this.manager.saveTask(task, document);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
			this.render();
		}
	}
	private renderCalendar(parent: HTMLElement, tasks: ReturnType<typeof filterProjectTasks>): void {
		const fields = this.displayFields('calendar');
		const controls = parent.createDiv({ cls: 'op-calendar-controls' });
		const changePeriod = (delta: number) => {
			this.calendarCursor = moveCalendarCursor(this.calendarCursor, this.calendarMode, delta);
			this.render();
		};
		const previousLabel = this.calendarMode === 'week' ? '上一周' : '上个月';
		const nextLabel = this.calendarMode === 'week' ? '下一周' : '下个月';
		const previous = controls.createEl('button', { text: previousLabel });
		previous.addEventListener('click', () => changePeriod(-1));
		controls.createEl('strong', { text: calendarRangeTitle(this.calendarCursor, this.calendarMode) });
		const next = controls.createEl('button', { text: nextLabel });
		next.addEventListener('click', () => changePeriod(1));
		const modeSwitch = controls.createDiv({ cls: 'op-calendar-mode-switch' });
		for (const [mode, label] of [['month', '月'], ['week', '周']] as const) {
			const button = modeSwitch.createEl('button', { text: label, attr: { type: 'button' } });
			button.toggleClass('is-active', this.calendarMode === mode);
			button.addEventListener('click', () => { this.calendarMode = mode; this.render(); });
		}
		const grid = parent.createDiv({ cls: `op-calendar-grid is-${this.calendarMode}` });
		for (const weekday of ['一', '二', '三', '四', '五', '六', '日']) grid.createDiv({ cls: 'op-calendar-weekday', text: weekday });
		const items = calendarItems(tasks);
		const dates = this.calendarMode === 'week' ? calendarWeekDates(this.calendarCursor) : calendarMonthCells(this.calendarCursor);
		for (const date of dates) this.renderCalendarDateCell(grid, date, items, fields);
	}
	private renderCalendarDateCell(
		grid: HTMLElement,
		date: string | null,
		items: ReturnType<typeof calendarItems>,
		fields: readonly TaskDisplayField[],
	): void {
		if (!date) {
			grid.createDiv({ cls: 'op-calendar-day is-empty' });
			return;
		}
		const cell = grid.createDiv({ cls: 'op-calendar-day' });
		cell.dataset.date = date;
		cell.createEl('strong', { text: this.calendarMode === 'week' ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : String(Number(date.slice(8, 10))) });
		for (const item of items.filter((candidate) => candidate.start <= date && candidate.end >= date)) {
			const task = this.manager.index.get(item.uid);
			if (!task) continue;
			const button = cell.createDiv({ cls: 'op-calendar-task', attr: { role: 'button', tabindex: '0', 'aria-label': task.document.metadata.title } });
			renderTaskCardFields(button, task, this.manager, fields, {
				titleClassName: 'op-calendar-task-title', compact: true, component: this, markerBeforeKey: true, priorityInCorner: true,
				keyTitleInline: true,
			});
			bindTaskCardActivation(button, () => new EditTaskModal(this.manager, task).open());
		}
	}
	private displayFields(mode: Mode): readonly TaskDisplayField[] {
		return this.manager.projectViewDisplay[mode];
	}
	private scopedProjects(): ProjectConfig[] {
		return this.projectUid === ALL_PROJECTS_UID
			? this.manager.projects
			: this.manager.projects.filter((project) => project.uid === this.projectUid);
	}
}
