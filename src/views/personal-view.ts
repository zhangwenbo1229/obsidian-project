import { ItemView, Menu, setIcon, WorkspaceLeaf } from 'obsidian';
import type { DashboardCardKind, DashboardMetric, PersonalDashboardCardLayout, TaskDisplayField } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import { EditTaskModal } from '../modals/edit-task-modal';
import { DataIssuesModal } from '../modals/data-issues-modal';
import { DashboardCardSettingsModal } from '../modals/dashboard-card-settings-modal';
import type { ProjectManager } from '../services/project-manager';
import { localDate } from '../utils/dates';
import { createUuid } from '../utils/ids';
import {
	bindDashboardFilter,
	BUILT_IN_DASHBOARD_CARD_IDS,
	calculateDashboardResizePreview,
	createDashboardCard,
	deleteDashboardCard,
	defaultDashboardCardBackground,
	reorderDashboardCards,
	resizeDashboardCard,
} from './dashboard-layout';
import { restoreProjectFilter } from './saved-project-filters';
import { filterProjectTasks, overdueTasks, pendingTasks, taskStatistics } from './selectors';
import { renderTaskCardFields } from './task-card-fields';
import { bindTaskCardActivation } from './task-card-interaction';
import { DASHBOARD_MODULE_DEFINITIONS, getDashboardModuleDefinition } from './dashboard-modules/registry';

export const PERSONAL_VIEW_TYPE = 'obsidian-project-personal';

const CARD_LABELS: Record<string, string> = {
	completed: '已完成',
	incomplete: '未完成',
	terminated: '已终止',
	'overdue-stat': '已逾期',
	'completion-rate': '完成率',
	'overdue-list': '当前逾期',
	'pending-list': '待完成任务',
};

const STAT_ICONS: Record<DashboardMetric, string> = {
	total: 'layers-3', completed: 'circle-check-big', incomplete: 'circle-dashed', terminated: 'circle-slash-2',
	overdue: 'alarm-clock', 'completion-rate': 'chart-no-axes-combined', 'overdue-rate': 'triangle-alert',
};

export class PersonalView extends ItemView {
	private renderGeneration = 0;

	constructor(leaf: WorkspaceLeaf, private readonly manager: ProjectManager) {
		super(leaf);
	}

	getViewType(): string { return PERSONAL_VIEW_TYPE; }
	getDisplayText(): string { return '个人视图'; }
	getIcon(): string { return 'layout-dashboard'; }

	async onOpen(): Promise<void> {
		this.register(this.manager.onChange(() => this.render()));
		this.render();
	}

	private render(): void {
		const generation = ++this.renderGeneration;
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('op-view', 'op-personal-view');
		const allTasks = this.manager.index.validTasks();
		const today = localDate();

		const hero = container.createDiv({ cls: 'op-view-hero' });
		const heroCopy = hero.createDiv();
		heroCopy.createDiv({ cls: 'op-eyebrow', text: 'MY WORK / 我的工作台' });
		heroCopy.createEl('h2', { text: '任务概览' });
		heroCopy.createEl('p', { text: '拖拽卡片调整位置，拖动右下角调整大小，右键绑定保存筛选器。' });
		const issueButton = hero.createEl('button', {
			cls: 'op-quiet-action',
			text: `数据问题 ${this.manager.dataIssues.length + this.manager.pendingMigrations.length}`,
		});
		issueButton.addEventListener('click', () => new DataIssuesModal(this.manager).open());

		const workspace = container.createDiv({ cls: 'op-dashboard-workspace' });
		workspace.addEventListener('contextmenu', (event) => {
			if (event.target === workspace) this.openWorkspaceMenu(event);
		});
		for (const card of this.manager.personalDashboardLayout) {
			const tasks = this.tasksForCard(card, allTasks);
			const cardEl = workspace.createDiv({ cls: 'op-dashboard-card' });
			cardEl.dataset.cardId = card.id;
			cardEl.dataset.columnSpan = String(card.columnSpan);
			cardEl.dataset.rowSpan = String(card.rowSpan);
			cardEl.dataset.kind = card.kind;
			cardEl.draggable = true;
			cardEl.style.gridColumn = `span ${card.columnSpan}`;
			cardEl.style.gridRow = `span ${card.rowSpan}`;
			cardEl.style.minHeight = `${card.rowSpan * 112}px`;
			cardEl.style.setProperty('--op-dashboard-card-background', card.backgroundColor ?? defaultDashboardCardBackground(card.metric, card.kind));
			cardEl.addEventListener('dragstart', (event) => event.dataTransfer?.setData('text/plain', card.id));
			cardEl.addEventListener('dragover', (event) => event.preventDefault());
			cardEl.addEventListener('drop', (event) => {
				event.preventDefault();
				const dragged = event.dataTransfer?.getData('text/plain');
				if (!dragged || dragged === card.id) return;
				void this.manager.savePersonalDashboardLayout(
					reorderDashboardCards(this.manager.personalDashboardLayout, dragged, card.id),
				).then(() => this.render());
			});
			cardEl.addEventListener('contextmenu', (event) => this.openFilterMenu(event, card));
			this.attachResizeHandle(cardEl, card, workspace);
			this.renderDashboardCard(cardEl, card, tasks, today, generation);
		}
	}

	private tasksForCard(card: PersonalDashboardCardLayout, allTasks: readonly IndexedTask[]): IndexedTask[] {
		const preset = this.manager.savedProjectFilters.find((filter) => filter.id === card.filterId);
		if (!preset) return [...allTasks];
		return filterProjectTasks(allTasks, restoreProjectFilter(preset.filters));
	}

	private renderDashboardCard(
		cardEl: HTMLElement,
		card: PersonalDashboardCardLayout,
		tasks: IndexedTask[],
		today: string,
		generation: number,
	): void {
		const filter = this.manager.savedProjectFilters.find((item) => item.id === card.filterId);
		const definition = getDashboardModuleDefinition(card.kind);
		const heading = cardEl.createDiv({ cls: 'op-dashboard-card-heading' });
		heading.createEl('strong', { text: card.title ?? CARD_LABELS[card.id] ?? definition?.label ?? '自定义卡片' });
		if (filter) heading.createSpan({ cls: 'op-dashboard-filter-badge', text: filter.name });
		if (definition) {
			cardEl.addClass('op-dashboard-module-card', `is-${definition.kind}`);
			void Promise.resolve(definition.render({
				container: cardEl,
				heading,
				card,
				manager: this.manager,
				refresh: () => this.render(),
				isCurrent: () => this.renderGeneration === generation && cardEl.isConnected,
			})).catch((error: unknown) => {
				if (this.renderGeneration !== generation || !cardEl.isConnected) return;
				cardEl.createDiv({ cls: 'op-dashboard-module-error', text: error instanceof Error ? error.message : String(error) });
			});
			return;
		}
		if (card.kind === 'task-list') {
			const selected = this.tasksForMetric(tasks, card.metric, today);
			heading.createSpan({ cls: 'op-count-pill', text: String(selected.length) });
			const list = cardEl.createDiv({ cls: `op-task-card-list is-${card.taskListDirection}` });
			this.renderTasks(list, selected, card.displayFields);
			return;
		}
		cardEl.addClass('op-dashboard-stat-card');
		cardEl.style.setProperty('--op-dashboard-card-accent', card.backgroundColor ?? defaultDashboardCardBackground(card.metric, card.kind));
		const stats = taskStatistics(tasks, today);
		const total = stats.completed + stats.incomplete + stats.terminated;
		const values: Record<DashboardMetric, number> = {
			total,
			completed: stats.completed,
			incomplete: stats.incomplete,
			terminated: stats.terminated,
			overdue: stats.overdue,
			'completion-rate': stats.completionRate,
			'overdue-rate': stats.incomplete === 0 ? 0 : stats.overdue / stats.incomplete,
		};
		const rawValue = values[card.metric];
		const text = card.kind === 'percentage' ? `${Math.round(rawValue * 100)}%` : String(rawValue);
		const body = cardEl.createDiv({ cls: 'op-dashboard-stat-body' });
		const icon = body.createSpan({ cls: 'op-dashboard-stat-icon', attr: { 'aria-hidden': 'true' } });
		setIcon(icon, STAT_ICONS[card.metric]);
		const value = body.createDiv({ cls: 'op-dashboard-stat-value', text });
		if (card.numberColor) value.style.color = card.numberColor;
	}

	private tasksForMetric(tasks: IndexedTask[], metric: DashboardMetric, today: string): IndexedTask[] {
		if (metric === 'overdue' || metric === 'overdue-rate') return overdueTasks(tasks, today);
		if (metric === 'incomplete') return pendingTasks(tasks);
		if (metric === 'total') return tasks;
		return tasks.filter((task) => {
			const status = task.project.workflow.statuses.find((item) => item.id === task.document.metadata.statusId);
			if (metric === 'completed' || metric === 'completion-rate') return status?.result === 'completed';
			return status?.result === 'terminated';
		});
	}

	private openWorkspaceMenu(event: MouseEvent): void {
		event.preventDefault();
		const menu = new Menu();
		const addCard = (kind: DashboardCardKind, title: string, icon: string) => {
			if (!this.isCardKindEnabled(kind)) return;
			menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(() => {
				const card = createDashboardCard(createUuid(), kind, this.manager.personalDashboardLayout.length);
				void this.manager.savePersonalDashboardLayout([
					...this.manager.personalDashboardLayout,
					card,
				]).then(() => {
					this.render();
					new DashboardCardSettingsModal(this.manager, card, '自定义卡片', () => this.render()).open();
				});
			}));
		};
		addCard('number', '新增数字卡片', 'hash');
		addCard('percentage', '新增百分比卡片', 'percent');
		addCard('task-list', '新增任务列表卡片', 'list-checks');
		for (const definition of DASHBOARD_MODULE_DEFINITIONS) {
			addCard(definition.kind, `新增${definition.label}卡片`, definition.icon);
		}
		menu.showAtMouseEvent(event);
	}

	private isCardKindEnabled(kind: DashboardCardKind): boolean {
		return this.manager.personalDashboardSettings.enabledCardKinds.includes(kind);
	}

	private openFilterMenu(event: MouseEvent, card: PersonalDashboardCardLayout): void {
		event.preventDefault();
		const menu = new Menu();
		menu.addItem((item) => item.setTitle('卡片设置').setIcon('settings-2').onClick(() => {
			new DashboardCardSettingsModal(this.manager, card, CARD_LABELS[card.id] ?? '自定义卡片', () => this.render()).open();
		}));
		if (!BUILT_IN_DASHBOARD_CARD_IDS.has(card.id)) {
			menu.addItem((item) => item.setTitle('删除卡片').setIcon('trash-2').onClick(() => {
				void this.manager.savePersonalDashboardLayout(
					deleteDashboardCard(this.manager.personalDashboardLayout, card.id),
				).then(() => this.render());
			}));
		}
		if (getDashboardModuleDefinition(card.kind)) {
			menu.showAtMouseEvent(event);
			return;
		}
		menu.addSeparator();
		menu.addItem((item) => item.setTitle('不绑定筛选器').setChecked(card.filterId === null).onClick(() => {
			void this.manager.savePersonalDashboardLayout(
				bindDashboardFilter(this.manager.personalDashboardLayout, card.id, null),
			).then(() => this.render());
		}));
		for (const filter of this.manager.savedProjectFilters) {
			menu.addItem((item) => item.setTitle(filter.name).setChecked(card.filterId === filter.id).onClick(() => {
				void this.manager.savePersonalDashboardLayout(
					bindDashboardFilter(this.manager.personalDashboardLayout, card.id, filter.id),
				).then(() => this.render());
			}));
		}
		menu.showAtMouseEvent(event);
	}

	private attachResizeHandle(
		cardEl: HTMLElement,
		card: PersonalDashboardCardLayout,
		workspace: HTMLElement,
	): void {
		const handle = cardEl.createEl('button', {
			cls: 'op-dashboard-resize-handle',
			attr: { 'aria-label': '调整卡片大小', title: '调整卡片大小', type: 'button' },
		});
		setIcon(handle, 'scaling');
		handle.draggable = false;
		handle.addEventListener('pointerdown', (event) => {
			event.preventDefault();
			event.stopPropagation();
			const startX = event.clientX;
			const startY = event.clientY;
			const computed = getComputedStyle(workspace);
			const columns = computed.gridTemplateColumns.split(/\s+/u).filter(Boolean).length || 1;
			const gap = Number.parseFloat(computed.columnGap) || 0;
			const columnUnit = (workspace.clientWidth + gap) / columns;
			const rowUnit = 112 + (Number.parseFloat(computed.rowGap) || 0);
			let preview = { columnSpan: card.columnSpan, rowSpan: card.rowSpan };
			cardEl.draggable = false;
			handle.setPointerCapture(event.pointerId);
			const move = (moveEvent: PointerEvent) => {
				preview = calculateDashboardResizePreview(
					card.columnSpan,
					card.rowSpan,
					moveEvent.clientX - startX,
					moveEvent.clientY - startY,
					columnUnit,
					rowUnit,
				);
				cardEl.dataset.resizePreview = `${preview.columnSpan} × ${preview.rowSpan}`;
			};
			const finish = () => {
				handle.removeEventListener('pointermove', move);
				cardEl.draggable = true;
				delete cardEl.dataset.resizePreview;
				if (preview.columnSpan === card.columnSpan && preview.rowSpan === card.rowSpan) return;
				void this.manager.savePersonalDashboardLayout(resizeDashboardCard(
					this.manager.personalDashboardLayout,
					card.id,
					preview.columnSpan,
					preview.rowSpan,
				)).then(() => this.render());
			};
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', finish, { once: true });
			handle.addEventListener('pointercancel', finish, { once: true });
		});
	}

	private renderTasks(container: HTMLElement, tasks: IndexedTask[], displayFields: readonly TaskDisplayField[]): void {
		if (tasks.length === 0) {
			container.createDiv({ cls: 'op-empty-state', text: '这里暂时没有任务' });
			return;
		}
		for (const task of tasks) {
			const row = container.createDiv({ cls: 'op-task-card', attr: { role: 'button', tabindex: '0', 'aria-label': task.document.metadata.title } });
			renderTaskCardFields(row, task, this.manager, displayFields, { titleClassName: 'op-task-card-title', component: this });
			bindTaskCardActivation(row, () => new EditTaskModal(this.manager, task).open());
		}
	}
}
