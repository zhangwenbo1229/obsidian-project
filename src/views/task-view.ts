import { ItemView, Menu, Notice, setIcon, type WorkspaceLeaf } from 'obsidian';
import { CreateSubtaskModal } from '../modals/create-subtask-modal';
import { EditSubtaskModal } from '../modals/edit-subtask-modal';
import type { ProjectManager } from '../services/project-manager';
import { localDate } from '../utils/dates';
import { renderTaskMetadata } from './task-metadata-presentation';
import { editTaskMetadataInline } from './task-metadata-inline-editor';
import {
	collectTaskViewItems,
	filterTaskViewItems,
	groupTaskViewItems,
	taskViewItemDate,
	updateTaskViewItemCompletion,
	updateTaskViewItemTitle,
	type TaskViewItem,
	type TaskViewScope,
} from './task-view-model';

export const TASK_VIEW_TYPE = 'obsidian-project-tasks';

const SCOPE_LABELS: Record<TaskViewScope, { label: string; icon: string }> = {
	all: { label: '全部任务', icon: 'list-checks' },
	today: { label: '今天', icon: 'sun' },
	upcoming: { label: '即将开始', icon: 'calendar-days' },
	overdue: { label: '已逾期', icon: 'circle-alert' },
	completed: { label: '已完成', icon: 'circle-check-big' },
};

export class TaskView extends ItemView {
	private activeScope: TaskViewScope = 'all';
	private projectUid: string | null = null;
	private keyword = '';
	private sidebarCollapsed = false;
	private showCompleted = false;

	constructor(leaf: WorkspaceLeaf, private readonly manager: ProjectManager) { super(leaf); }
	getViewType(): string { return TASK_VIEW_TYPE; }
	getDisplayText(): string { return '任务视图'; }
	getIcon(): string { return 'list-checks'; }

	async onOpen(): Promise<void> {
		this.register(this.manager.onChange(() => this.render()));
		this.render();
	}

	private render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('op-view', 'op-task-view');
		const allItems = collectTaskViewItems(this.manager.index.validTasks());
		const today = localDate();

		const header = container.createDiv({ cls: 'op-task-view-header op-view-hero' });
		const heading = header.createDiv({ cls: 'op-task-view-heading' });
		heading.createDiv({ cls: 'op-eyebrow', text: 'TASKS / 任务' });
		heading.createEl('h2', { text: SCOPE_LABELS[this.activeScope].label });
		const actions = header.createDiv({ cls: 'op-task-view-actions' });
		const searchWrap = actions.createDiv({ cls: 'op-task-view-search' });
		const searchIcon = searchWrap.createSpan({ cls: 'op-task-view-search-icon' });
		setIcon(searchIcon, 'search');
		const search = searchWrap.createEl('input', { type: 'search', placeholder: '搜索任务或项目' });
		search.value = this.keyword;
		search.addEventListener('input', () => { this.keyword = search.value; this.renderContent(main, allItems, today); });
		const showCompletedWrap = actions.createDiv({ cls: 'op-task-view-show-completed' });
		const showCompletedCheckbox = showCompletedWrap.createEl('input', { type: 'checkbox', attr: { id: 'op-show-completed', 'aria-label': '显示已完成任务' } });
		showCompletedCheckbox.checked = this.showCompleted;
		showCompletedCheckbox.addEventListener('change', () => { this.showCompleted = showCompletedCheckbox.checked; this.renderContent(main, allItems, today); });
		showCompletedWrap.createEl('label', { text: '显示已完成', attr: { for: 'op-show-completed' } });
		const add = actions.createEl('button', { cls: 'mod-cta op-task-view-add', attr: { type: 'button' } });
		setIcon(add.createSpan(), 'plus');
		add.createSpan({ text: '新增任务' });
		add.addEventListener('click', () => new CreateSubtaskModal(this.manager).open());

		const shell = container.createDiv({ cls: 'op-task-view-shell' });
		shell.toggleClass('is-sidebar-collapsed', this.sidebarCollapsed);
		const sidebar = shell.createEl('aside', { cls: 'op-task-view-sidebar' });
		const sidebarToggle = sidebar.createEl('button', {
			cls: 'op-task-view-sidebar-toggle',
			attr: {
				type: 'button',
				'aria-label': this.sidebarCollapsed ? '展开任务导航' : '折叠任务导航',
				title: this.sidebarCollapsed ? '展开任务导航' : '折叠任务导航',
				'aria-expanded': String(!this.sidebarCollapsed),
			},
		});
		setIcon(sidebarToggle, this.sidebarCollapsed ? 'panel-left-open' : 'panel-left-close');
		sidebarToggle.addEventListener('click', () => { this.sidebarCollapsed = !this.sidebarCollapsed; this.render(); });
		this.renderNavigation(sidebar, allItems, today);
		const main = shell.createEl('main', { cls: 'op-task-view-main' });
		this.renderContent(main, allItems, today);
	}

	private renderNavigation(parent: HTMLElement, items: readonly TaskViewItem[], today: string): void {
		const scopes = parent.createDiv({ cls: 'op-task-view-nav-section' });
		for (const scope of Object.keys(SCOPE_LABELS) as TaskViewScope[]) {
			const count = filterTaskViewItems(items, { scope, today }).length;
			const button = scopes.createEl('button', { cls: 'op-task-view-nav-item', attr: { type: 'button' } });
			button.toggleClass('is-active', this.activeScope === scope && this.projectUid === null);
			setIcon(button.createSpan({ cls: 'op-task-view-nav-icon' }), SCOPE_LABELS[scope].icon);
			button.createSpan({ cls: 'op-task-view-nav-label', text: SCOPE_LABELS[scope].label });
			button.createSpan({ cls: 'op-task-view-nav-count', text: String(count) });
			button.addEventListener('click', () => { this.activeScope = scope; this.projectUid = null; this.render(); });
		}
		parent.createDiv({ cls: 'op-task-view-sidebar-label', text: '分组' });
		const groups = parent.createDiv({ cls: 'op-task-view-nav-section' });
		for (const project of this.manager.projects) {
			const count = items.filter((item) => item.projectUid === project.uid).length;
			const button = groups.createEl('button', { cls: 'op-task-view-nav-item', attr: { type: 'button' } });
			button.toggleClass('is-active', this.projectUid === project.uid);
			const projectIcon = project.icon || 'folder';
			setIcon(button.createSpan({ cls: 'op-task-view-nav-icon' }), projectIcon);
			if (project.color) button.style.setProperty('--op-project-color', project.color);
			button.createSpan({ cls: 'op-task-view-nav-label', text: project.name });
			button.createSpan({ cls: 'op-task-view-nav-count', text: String(count) });
			button.addEventListener('click', () => { this.activeScope = 'all'; this.projectUid = project.uid; this.render(); });
		}
	}

	private renderContent(parent: HTMLElement, allItems: readonly TaskViewItem[], today: string): void {
		parent.empty();
		const items = filterTaskViewItems(allItems, {
			scope: this.activeScope, today, projectUid: this.projectUid, keyword: this.keyword, showCompleted: this.showCompleted,
		});
		const summary = parent.createDiv({ cls: 'op-task-view-summary' });
		summary.createSpan({ text: `${items.length} 个任务` });
		if (this.keyword) summary.createSpan({ cls: 'op-task-view-query', text: `“${this.keyword}”` });
		if (items.length === 0) {
			const empty = parent.createDiv({ cls: 'op-task-view-empty' });
			setIcon(empty.createSpan(), 'list-checks');
			empty.createEl('strong', { text: '当前范围没有任务' });
			return;
		}
		const groups = parent.createDiv({ cls: 'op-task-view-groups' });
		for (const group of groupTaskViewItems(items)) {
			const section = groups.createEl('section', { cls: 'op-task-view-group' });
			const project = this.manager.projects.find((p) => p.code === group.projectCode);
			const groupHeading = section.createEl('button', { cls: 'op-task-view-group-heading', attr: { type: 'button' } });
			const projectIcon = project?.icon || 'key';
			const iconSpan = groupHeading.createSpan({ cls: 'op-task-view-project-icon' });
			if (/^[a-z0-9][a-z0-9-]*$/iu.test(projectIcon)) setIcon(iconSpan, projectIcon);
			else iconSpan.textContent = projectIcon;
			if (project?.color) groupHeading.style.setProperty('--op-project-color', project.color);
			groupHeading.createSpan({ cls: 'op-task-view-project-key', text: group.parentKey });
			groupHeading.createEl('strong', { text: group.parentTitle });
			groupHeading.createSpan({ cls: 'op-task-view-project-name', text: group.projectName });
			groupHeading.createSpan({ cls: 'op-task-view-group-count', text: String(group.items.length) });
			groupHeading.addEventListener('click', () => void this.manager.openTask(group.parentPath));
			const list = section.createDiv({ cls: 'op-task-view-list' });
			for (const item of group.items) this.renderTaskRow(list, item);
		}
	}

	private renderTaskRow(parent: HTMLElement, item: TaskViewItem): void {
		const row = parent.createDiv({ cls: `op-task-view-row${item.completed ? ' is-completed' : ''}` });
		const checkbox = row.createEl('input', { cls: 'op-task-view-checkbox', type: 'checkbox', attr: { 'aria-label': `完成任务：${item.title}` } });
		checkbox.checked = item.completed;
		checkbox.addEventListener('change', () => void this.toggleCompletion(item, checkbox.checked, checkbox));
		const content = row.createDiv({ cls: 'op-task-view-row-content' });
		const titleButton = content.createEl('button', { cls: 'op-task-view-row-title-button', attr: { type: 'button', title: '单击编辑；右键打开任务设置' } });
		titleButton.createSpan({ cls: 'op-task-view-row-title', text: item.title });
		renderTaskMetadata(content, item, this.manager, 'taskView', `${item.projectCode} · ${item.projectName}`, {
			onEdit: (field, target) => editTaskMetadataInline(target, item, field, this.manager),
		});
		const editInline = (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			this.editTitle(content, titleButton, item);
		};
		titleButton.addEventListener('click', editInline);
		titleButton.addEventListener('dblclick', editInline);
		titleButton.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			event.stopPropagation();
			const menu = new Menu();
			menu.addItem((menuItem) => menuItem.setTitle('编辑任务').setIcon('square-pen').onClick(() => {
				if (item.kind === 'structured' && item.taskId) new EditSubtaskModal(this.manager, item.parent, {
					id: item.taskId, title: item.title, completed: item.completed,
					priority: item.priority === 'normal' ? 'medium' : item.priority,
					scheduledDate: item.scheduledDate, startDate: item.startDate, dueDate: item.dueDate,
					tags: item.tags, createdDate: item.createdDate, doneDate: item.doneDate, cancelledDate: item.cancelledDate,
				}).open();
				else void this.manager.openTask(item.parentPath);
			}));
			if (item.kind === 'structured' && item.taskId) menu.addItem((menuItem) => menuItem
				.setTitle('删除任务')
				.setIcon('trash-2')
				.onClick(() => void this.manager.deleteEmbeddedSubtask(item.parent, item.taskId!)));
			menu.showAtMouseEvent(event);
		});
		const date = taskViewItemDate(item);
		if (date) row.createEl('time', { cls: 'op-task-view-date', text: date, attr: { datetime: date } });
		const source = row.createEl('button', { cls: 'op-task-view-source', attr: { type: 'button', title: '打开所属项目', 'aria-label': `打开项目：${item.parentTitle}` } });
		setIcon(source, 'arrow-up-right');
		source.addEventListener('click', () => void this.manager.openTask(item.parentPath));
	}

	private async toggleCompletion(item: TaskViewItem, completed: boolean, checkbox: HTMLInputElement): Promise<void> {
		checkbox.disabled = true;
		try {
			const document = structuredClone(item.parent.document);
			document.subtasks = updateTaskViewItemCompletion(document.subtasks ?? '', item, completed, localDate());
			await this.manager.saveTask(item.parent, document);
		} catch (error) {
			checkbox.checked = !completed;
			checkbox.disabled = false;
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private editTitle(container: HTMLElement, button: HTMLButtonElement, item: TaskViewItem): void {
		if (button.hidden || container.querySelector('.op-task-view-inline-editor')) return;
		button.hidden = true;
		const input = button.ownerDocument.createElement('input');
		input.className = 'op-task-view-inline-editor';
		input.type = 'text';
		input.setAttribute('aria-label', '编辑任务标题');
		button.insertAdjacentElement('afterend', input);
		input.value = item.title;
		input.focus(); input.select();
		let finished = false;
		const cancel = () => { if (finished) return; finished = true; input.remove(); button.hidden = false; };
		const save = async () => {
			if (finished) return;
			finished = true; input.disabled = true;
			try {
				const document = structuredClone(item.parent.document);
				document.subtasks = updateTaskViewItemTitle(document.subtasks ?? '', item, input.value);
				await this.manager.saveTask(item.parent, document);
			} catch (error) {
				finished = false; input.disabled = false; input.focus();
				new Notice(error instanceof Error ? error.message : String(error));
			}
		};
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') cancel();
			else if (event.key === 'Enter') { event.preventDefault(); void save(); }
		});
		input.addEventListener('blur', () => void save());
	}
}
