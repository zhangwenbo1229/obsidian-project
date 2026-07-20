import { Component, Notice } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { IndexedTask } from '../index/task-index';
import { filterProjectTasks } from './selectors';
import { transitionTask } from '../domain/workflow';
import type { TaskDisplayField } from '../domain/types';
import { renderTaskCardFields } from './task-card-fields';
import { bindTaskCardActivation } from './task-card-interaction';
import { EditTaskModal } from '../modals/edit-task-modal';
import { openTaskCardContextMenu } from './task-card-context-menu';

export function renderBoardView(
	parent: HTMLElement,
	tasks: ReturnType<typeof filterProjectTasks>,
	manager: ProjectManager,
	fields: readonly TaskDisplayField[],
	component: Component,
	onRerender: () => void,
): void {
	const rules = manager.projectViewDisplay.behavior.board;
	const board = parent.createDiv({ cls: 'op-board' });
	for (const [category, name] of [['todo', '未开始'], ['in_progress', '处理中'], ['done', '已完成']] as const) {
		if (category === 'done' && !rules.showCompletedColumn) continue;
		const column = board.createDiv({ cls: 'op-board-column' });
		column.dataset.statusGroup = category;
		if (rules.autoUpdateStatusOnDrop) {
			column.addEventListener('dragover', (event) => event.preventDefault());
			column.addEventListener('drop', (event) => {
				event.preventDefault();
				const uid = event.dataTransfer?.getData('text/plain');
				const task = uid ? manager.index.get(uid) : undefined;
				if (task) void moveCardToBoardGroup(task, category, manager, rules, onRerender);
			});
		}
		const grouped = tasks.filter((task) => boardGroup(task, manager) === category);
		column.createEl('h4', { text: `${name} · ${grouped.length}` });
		for (const task of grouped) {
			renderBoardCard(column, task, rules.autoUpdateStatusOnDrop, fields, manager, component);
		}
	}
}

function boardGroup(task: IndexedTask, manager: ProjectManager): 'todo' | 'in_progress' | 'done' {
	const rules = manager.projectViewDisplay.behavior.board;
	for (const category of ['todo', 'in_progress', 'done'] as const) {
		if (rules.groupStatusIds[category].includes(task.document.metadata.statusId)) return category;
	}
	return task.project.workflow.statuses.find((s) => s.id === task.document.metadata.statusId)?.category ?? 'todo';
}

async function moveCardToBoardGroup(
	task: IndexedTask,
	category: 'todo' | 'in_progress' | 'done',
	manager: ProjectManager,
	rules: typeof manager.projectViewDisplay.behavior.board,
	onRerender: () => void,
): Promise<void> {
	if (boardGroup(task, manager) === category) return;
	const configured = rules.groupStatusIds[category];
	const candidates = task.project.workflow.statuses.filter((s) => configured.includes(s.id) || (configured.length === 0 && s.category === category));
	const transitions = new Set(task.project.workflow.transitions
		.filter((t) => t.from === task.document.metadata.statusId)
		.map((t) => t.to));
	const target = candidates.find((s) => transitions.has(s.id)) ?? candidates[0];
	if (target) await moveCard(task, target.id, manager, onRerender);
}

function renderBoardCard(
	parent: HTMLElement,
	task: IndexedTask,
	draggable: boolean,
	fields: readonly TaskDisplayField[],
	manager: ProjectManager,
	component: Component,
): void {
	const card = parent.createDiv({ cls: 'op-board-card', attr: { role: 'button', tabindex: '0', 'aria-label': task.document.metadata.title } });
	renderTaskCardFields(card, task, manager, fields, {
		titleClassName: 'op-board-card-title', component, markerBeforeKey: true, priorityInCorner: true, keyTitleInline: true,
	});
	card.draggable = draggable;
	if (draggable) card.addEventListener('dragstart', (event) => event.dataTransfer?.setData('text/plain', task.document.metadata.uid));
	bindTaskCardActivation(card, () => new EditTaskModal(manager, task).open());
	card.addEventListener('contextmenu', (event) => openTaskCardContextMenu(event, task, manager));
}

async function moveCard(
	task: IndexedTask,
	statusId: string,
	manager: ProjectManager,
	onRerender: () => void,
): Promise<void> {
	if (task.document.metadata.statusId === statusId) return;
	try {
		const document = structuredClone(task.document);
		document.metadata = transitionTask(document.metadata, task.project.workflow, statusId);
		await manager.saveTask(task, document);
	} catch (error) {
		new Notice(error instanceof Error ? error.message : String(error));
		onRerender();
	}
}