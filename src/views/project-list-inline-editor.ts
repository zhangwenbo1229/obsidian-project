import { Notice } from 'obsidian';
import type { CustomFieldDefinition, TaskDocument } from '../domain/types';
import { transitionTask } from '../domain/workflow';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '../utils/dates';
import { taskFieldOptions } from '../settings/task-field-configuration';

export type ProjectListEditorKind = 'text' | 'number' | 'checkbox' | 'datetime-local' | 'date' | 'select';

function customField(task: IndexedTask, column: string): CustomFieldDefinition | undefined {
	return column.startsWith('custom:')
		? task.project.customFields.find((field) => field.key === column.slice('custom:'.length))
		: undefined;
}

export function projectListEditorKind(task: IndexedTask, column: string): ProjectListEditorKind | null {
	const custom = customField(task, column);
	if (custom) {
		if (custom.type === 'boolean') return 'checkbox';
		if (custom.type === 'number') return 'number';
		if (custom.type === 'date') return 'date';
		if (custom.type === 'datetime') return 'datetime-local';
		if (custom.type === 'single-select' || custom.type === 'user' || custom.type === 'task-reference') return 'select';
		return 'text';
	}
	if (['priority', 'type', 'status', 'reporter', 'assignee'].includes(column)) return 'select';
	if (['scheduledDate', 'startDate', 'dueDate', 'endDate'].includes(column)) return 'datetime-local';
	if (column === 'title' || column === 'tags') return 'text';
	return null;
}

function normalizedList(value: string): string[] {
	return [...new Set(value.split(/[,，]/u).map((item) => item.trim().replace(/^#+/u, '')).filter(Boolean))];
}

function customValue(field: CustomFieldDefinition, value: string | boolean): unknown {
	if (field.type === 'boolean') return typeof value === 'boolean' ? value : value === 'true';
	if (field.type === 'number') return value === '' ? null : Number(value);
	if (field.type === 'multi-select') return normalizedList(String(value));
	if (field.type === 'datetime') return fromDateTimeLocalInput(String(value));
	if (field.type === 'user' || field.type === 'task-reference' || field.type === 'date') return value || null;
	return String(value);
}

export function applyProjectListFieldValue(
	task: IndexedTask,
	column: string,
	value: string | boolean,
	now = new Date(),
): TaskDocument {
	const document = structuredClone(task.document);
	const metadata = document.metadata;
	const custom = customField(task, column);
	if (custom) {
		metadata.custom[custom.key] = customValue(custom, value);
		return document;
	}
	const text = String(value);
	if (column === 'title') {
		const title = text.trim().replace(/[\r\n]+/gu, ' ');
		if (!title) throw new Error('项目标题不能为空。');
		metadata.title = title;
	} else if (column === 'priority') metadata.priority = text;
	else if (column === 'type') metadata.taskTypeId = text;
	else if (column === 'status' && text !== metadata.statusId) document.metadata = transitionTask(metadata, task.project.workflow, text, now);
	else if (column === 'reporter') metadata.reporterId = text;
	else if (column === 'assignee') metadata.assigneeId = text || null;
	else if (column === 'tags') metadata.tags = normalizedList(text);
	else if (column === 'scheduledDate') metadata.scheduledDate = fromDateTimeLocalInput(text);
	else if (column === 'startDate') metadata.startDate = fromDateTimeLocalInput(text);
	else if (column === 'dueDate') metadata.dueDate = fromDateTimeLocalInput(text);
	else if (column === 'endDate') metadata.endDate = fromDateTimeLocalInput(text);
	return document;
}

function currentValue(task: IndexedTask, column: string): string | boolean {
	const metadata = task.document.metadata;
	const custom = customField(task, column);
	if (custom) {
		const value = metadata.custom[custom.key];
		if (custom.type === 'boolean') return Boolean(value);
		if (Array.isArray(value)) return value.join(', ');
		return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
	}
	const values: Record<string, string> = {
		title: metadata.title,
		priority: metadata.priority ?? 'medium',
		type: metadata.taskTypeId,
		status: metadata.statusId,
		reporter: metadata.reporterId,
		assignee: metadata.assigneeId ?? '',
		tags: metadata.tags.join(', '),
		scheduledDate: toDateTimeLocalInput(metadata.scheduledDate ?? null),
		startDate: toDateTimeLocalInput(metadata.startDate),
		dueDate: toDateTimeLocalInput(metadata.dueDate),
		endDate: toDateTimeLocalInput(metadata.endDate ?? null),
	};
	return values[column] ?? '';
}

function addOptions(select: HTMLSelectElement, task: IndexedTask, column: string, manager: ProjectManager): void {
	const add = (value: string, label: string) => select.createEl('option', { value, text: label });
	const custom = customField(task, column);
	if (column === 'priority') {
		const type = task.project.taskTypes.find((item) => item.id === task.document.metadata.taskTypeId);
		const options = taskFieldOptions(type, 'priority');
		for (const option of options) add(option.id, option.name);
		const current = task.document.metadata.priority;
		if (current && !options.some((option) => option.id === current)) add(current, `${current}（当前值）`);
	}
	else if (column === 'type') for (const type of task.project.taskTypes.filter((item) => item.active)) add(type.id, type.name);
	else if (column === 'status') {
		const allowed = new Set([task.document.metadata.statusId, ...task.project.workflow.transitions.filter((item) => item.from === task.document.metadata.statusId).map((item) => item.to)]);
		for (const status of task.project.workflow.statuses.filter((item) => allowed.has(item.id))) add(status.id, status.name);
	} else if (column === 'reporter' || column === 'assignee' || custom?.type === 'user') {
		if (column === 'assignee' || custom?.type === 'user') add('', '未选择');
		for (const person of manager.globalConfig.people.filter((item) => item.active)) add(person.id, person.name);
	} else if (custom?.type === 'single-select') for (const option of custom.options ?? []) add(option.id, option.name);
	else if (custom?.type === 'task-reference') {
		add('', '未选择');
		for (const candidate of manager.index.validTasks()) add(candidate.document.metadata.uid, `${candidate.document.metadata.key} · ${candidate.document.metadata.title}`);
	}
}

export function beginProjectListInlineEdit(
	cell: HTMLTableCellElement,
	task: IndexedTask,
	column: string,
	manager: ProjectManager,
): void {
	const kind = projectListEditorKind(task, column);
	if (!kind || cell.hasClass('is-editing')) return;
	const previousChildren = Array.from(cell.childNodes);
	cell.empty();
	cell.addClass('is-editing');
	const control = kind === 'select'
		? cell.createEl('select', { cls: 'op-project-list-inline-editor' })
		: cell.createEl('input', { cls: 'op-project-list-inline-editor', attr: { type: kind } });
	if (control instanceof HTMLSelectElement) addOptions(control, task, column, manager);
	const current = currentValue(task, column);
	if (control instanceof HTMLInputElement && kind === 'checkbox') control.checked = Boolean(current);
	else control.value = String(current);
	control.focus();
	if (control instanceof HTMLInputElement && kind !== 'checkbox') control.select();
	let finished = false;
	const restore = () => {
		if (finished) return;
		finished = true;
		cell.empty();
		cell.append(...previousChildren);
		cell.removeClass('is-editing');
	};
	const save = async () => {
		if (finished) return;
		finished = true;
		control.disabled = true;
		try {
			const value = control instanceof HTMLInputElement && kind === 'checkbox' ? control.checked : control.value;
			await manager.saveTask(task, applyProjectListFieldValue(task, column, value));
		} catch (error) {
			finished = false;
			control.disabled = false;
			control.focus();
			new Notice(error instanceof Error ? error.message : String(error));
		}
	};
	control.addEventListener('click', (event) => event.stopPropagation());
	control.addEventListener('keydown', (event) => {
		const keyboardEvent = event as KeyboardEvent;
		if (keyboardEvent.key === 'Escape') { keyboardEvent.preventDefault(); restore(); }
		else if (keyboardEvent.key === 'Enter') { keyboardEvent.preventDefault(); void save(); }
	});
	control.addEventListener('change', () => void save());
	control.addEventListener('blur', () => void save());
}
