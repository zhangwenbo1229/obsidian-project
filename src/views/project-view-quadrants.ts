import { Component, Notice } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { IndexedTask } from '../index/task-index';
import { filterProjectTasks, classifyTaskQuadrants, priorityForQuadrantDrop, type TaskQuadrant } from './selectors';
import type { TaskDisplayField } from '../domain/types';
import { localDate } from '../utils/dates';
import { renderTaskCardFields } from './task-card-fields';
import { bindTaskCardActivation } from './task-card-interaction';
import { EditTaskModal } from '../modals/edit-task-modal';

export function renderQuadrantsView(
	parent: HTMLElement,
	tasks: ReturnType<typeof filterProjectTasks>,
	manager: ProjectManager,
	fields: readonly TaskDisplayField[],
	component: Component,
	onRerender: () => void,
): void {
	const quadrants = classifyTaskQuadrants(tasks, localDate(), manager.projectViewDisplay.behavior.quadrants);
	const grid = parent.createDiv({ cls: 'op-quadrant-grid' });
	const definitions: Array<[TaskQuadrant, string, string]> = [
		['importantUrgent', '重要且紧急', '立即处理'],
		['importantNotUrgent', '重要不紧急', '安排计划'],
		['notImportantUrgent', '不重要但紧急', '快速处理或委派'],
		['notImportantNotUrgent', '不重要不紧急', '稍后评估'],
	];
	for (const [key, title, description] of definitions) {
		const region = grid.createDiv({ cls: `op-quadrant-region is-${key}` });
		region.setAttribute('data-quadrant', key);
		region.addEventListener('dragover', (event) => {
			event.preventDefault();
			region.addClass('is-drop-target');
		});
		region.addEventListener('dragleave', (event) => {
			if (!region.contains(event.relatedTarget as Node | null)) region.removeClass('is-drop-target');
		});
		region.addEventListener('drop', (event) => {
			event.preventDefault();
			region.removeClass('is-drop-target');
			const uid = event.dataTransfer?.getData('text/plain');
			const task = uid ? manager.index.get(uid) : undefined;
			if (task) void moveCardToQuadrant(task, key, manager, onRerender);
		});
		const heading = region.createDiv({ cls: 'op-quadrant-heading' });
		const copy = heading.createDiv();
		copy.createEl('h3', { text: title });
		copy.createEl('p', { text: description });
		heading.createSpan({ cls: 'op-count-pill', text: String(quadrants[key].length) });
		renderQuadrantCards(region, quadrants[key], fields, manager, component);
	}
}

function renderQuadrantCards(
	parent: HTMLElement,
	tasks: IndexedTask[],
	fields: readonly TaskDisplayField[],
	manager: ProjectManager,
	component: Component,
): void {
	const list = parent.createDiv({ cls: 'op-quadrant-card-list' });
	if (tasks.length === 0) {
		list.createDiv({ cls: 'op-empty-state', text: '暂无任务' });
		return;
	}
	for (const task of tasks) {
		const card = list.createDiv({ cls: 'op-quadrant-card', attr: { role: 'button', tabindex: '0', 'aria-label': task.document.metadata.title } });
		renderTaskCardFields(card, task, manager, fields, {
			titleClassName: 'op-quadrant-card-title', component, markerBeforeKey: true, priorityInCorner: true,
		});
		card.draggable = true;
		card.addEventListener('dragstart', (event) => {
			card.dataset.wasDragged = 'true';
			event.dataTransfer?.setData('text/plain', task.document.metadata.uid);
		});
		card.addEventListener('dragend', () => window.setTimeout(() => delete card.dataset.wasDragged, 0));
		card.addEventListener('click', (event) => {
			if (card.dataset.wasDragged) event.stopImmediatePropagation();
		});
		bindTaskCardActivation(card, () => new EditTaskModal(manager, task).open());
	}
}

async function moveCardToQuadrant(
	task: IndexedTask,
	quadrant: TaskQuadrant,
	manager: ProjectManager,
	onRerender: () => void,
): Promise<void> {
	const priority = priorityForQuadrantDrop(
		task.document.metadata.priority,
		quadrant,
		manager.projectViewDisplay.behavior.quadrants.importantPriorities,
	);
	if (priority === task.document.metadata.priority) return;
	try {
		const document = structuredClone(task.document);
		document.metadata.priority = priority;
		await manager.saveTask(task, document);
	} catch (error) {
		new Notice(error instanceof Error ? error.message : String(error));
		onRerender();
	}
}