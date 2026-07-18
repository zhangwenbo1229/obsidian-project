import { Component, MarkdownRenderer, setIcon } from 'obsidian';
import type { TaskDisplayField } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { displayDateTime } from '../utils/dates';
import { TASK_DISPLAY_FIELD_LABELS, taskDisplayFieldLabel } from './task-display-settings';
import { renderTaskPriority } from './task-priority-presentation';
import { renderTaskTitle } from './task-type-presentation';
import { renderTaskMarker } from './task-type-presentation';
import { renderTags } from './tag-presentation';
import { formatCustomFieldValue, formatTaskCustomFields } from './custom-field-presentation';
import { renderTaskRelations } from './task-relation-presentation';
import { enhanceRenderedTaskLists } from './subtask-presentation';
import { applyLabelPresentation, applyValuePresentation, renderFieldLabel } from './field-presentation';
import type { FieldPresentation } from './field-presentation';
import { resolveTaskFieldPresentation } from './task-field-presentation';
import { renderEmbeddedSubtasks } from './embedded-subtask-presentation';
import { PersonModal } from '../modals/person-modal';
import { taskFieldOptions } from '../settings/task-field-configuration';

export interface TaskCardFieldOptions {
	titleClassName?: string;
	compact?: boolean;
	component: Component;
	markerBeforeKey?: boolean;
	priorityInCorner?: boolean;
	keyTitleInline?: boolean;
}

function labeledField(
	parent: HTMLElement, field: TaskDisplayField, value: string, manager: ProjectManager, presentation?: FieldPresentation,
): HTMLElement | null {
	if (!value) return null;
	const className = field.startsWith('custom:') ? 'custom' : field;
	const element = parent.createDiv({ cls: `op-card-field is-${className}` });
	const definition = presentation ?? (field.startsWith('custom:')
		? taskCustomFields(manager).find((item) => item.key === field.slice('custom:'.length))
		: undefined);
	applyValuePresentation(element, definition);
	renderFieldLabel(element, taskDisplayFieldLabel(field, taskCustomFields(manager)), definition);
	element.createSpan({ cls: 'op-card-field-value', text: value });
	return element;
}

function personField(
	parent: HTMLElement,
	field: 'reporter' | 'assignee',
	personId: string | null,
	fallback: string,
	manager: ProjectManager,
	presentation?: FieldPresentation,
): void {
	const person = manager.globalConfig.people.find((item) => item.id === personId);
	const namePresentation = manager.globalConfig.personNamePresentation;
	const nameFieldPresentation: FieldPresentation = {
		icon: namePresentation?.icon || presentation?.icon,
		color: namePresentation?.color || presentation?.color,
	};
	const element = labeledField(parent, field, person?.name ?? fallback, manager, nameFieldPresentation);
	if (!person || !element) return;
	element.addClass('op-person-field-button');
	element.setAttribute('role', 'button');
	element.tabIndex = 0;
	const edit = (event: Event) => {
		event.preventDefault();
		event.stopPropagation();
		new PersonModal(manager, person).open();
	};
	element.addEventListener('click', edit);
	element.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') edit(event);
	});
}

function taskCustomFields(manager: ProjectManager) {
	return [...new Map(manager.projects.flatMap((project) => project.customFields).map((field) => [field.key, field])).values()];
}

export function renderTaskMarkdownValue(
	parent: HTMLElement,
	value: string,
	task: IndexedTask,
	manager: ProjectManager,
	component: Component,
): void {
	if (!value.trim()) return;
	parent.addClass('op-card-markdown');
	void MarkdownRenderer.render(manager.app, value, parent, task.path, component)
		.then(() => enhanceRenderedTaskLists(parent));
}

function markdownField(
	parent: HTMLElement,
	field: TaskDisplayField,
	value: string,
	task: IndexedTask,
	manager: ProjectManager,
	options: TaskCardFieldOptions,
	presentation?: FieldPresentation,
): void {
	if (!value.trim()) return;
	const element = parent.createDiv({ cls: `op-card-field is-${field}` });
	applyValuePresentation(element, presentation);
	renderFieldLabel(element, taskDisplayFieldLabel(field), presentation);
	const valueElement = element.createDiv({ cls: 'op-card-field-value' });
	renderTaskMarkdownValue(valueElement, value, task, manager, options.component);
}

export function renderTaskCardFields(
	parent: HTMLElement,
	task: IndexedTask,
	manager: ProjectManager,
	fields: readonly TaskDisplayField[],
	options: TaskCardFieldOptions,
): void {
	const flow = parent.createDiv({ cls: options.compact ? 'op-task-field-flow is-compact' : 'op-task-field-flow' });
	const metadata = task.document.metadata;
	const taskType = task.project.taskTypes.find((type) => type.id === metadata.taskTypeId);
	const presentation = (field: TaskDisplayField) => resolveTaskFieldPresentation(task, field);
	const renderKey = (container: HTMLElement) => {
		const key = container.createSpan({ cls: 'op-task-key' });
		if (options.markerBeforeKey) renderTaskMarker(key, taskType);
		key.createSpan({ text: metadata.key });
	};
	const renderTitle = (container: HTMLElement) => {
		const title = renderTaskTitle(container, taskType, metadata.title, {
			className: options.titleClassName ?? 'op-task-card-title',
			showMarker: !options.markerBeforeKey,
		});
		const configured = presentation('title');
		if (configured.color) title.style.setProperty('--op-task-title-color', configured.color);
		if (configured.icon) applyLabelPresentation(title, { icon: configured.icon });
		return title;
	};
	if (options.keyTitleInline && (fields.includes('key') || fields.includes('title'))) {
		const heading = flow.createDiv({ cls: 'op-task-card-heading-line' });
		if (fields.includes('key')) renderKey(heading);
		if (fields.includes('title')) renderTitle(heading);
	}
	for (const field of fields) {
		if (options.keyTitleInline && (field === 'key' || field === 'title')) continue;
		if (field === 'key') renderKey(flow);
		else if (field === 'title') renderTitle(flow);
		else if (field === 'priority') {
			const wrapper = (options.priorityInCorner ? parent : flow).createDiv({
				cls: options.priorityInCorner ? 'op-task-card-priority' : 'op-card-field is-priority',
			});
			applyValuePresentation(wrapper, presentation('priority'));
			if (!options.priorityInCorner) renderFieldLabel(wrapper, TASK_DISPLAY_FIELD_LABELS.priority, presentation('priority'));
			const priority = renderTaskPriority(wrapper, metadata.priority, taskFieldOptions(taskType, 'priority'));
			if (presentation('priority').color) priority.style.color = presentation('priority').color!;
			if (options.priorityInCorner && presentation('priority').icon) applyLabelPresentation(wrapper, { icon: presentation('priority').icon });
		}
		else if (field === 'project') {
			const project = task.project;
			const element = flow.createDiv({ cls: 'op-card-field is-project' });
			const definition = presentation('project');
			applyValuePresentation(element, definition);
			renderFieldLabel(element, taskDisplayFieldLabel(field, taskCustomFields(manager)), definition);
			const value = element.createDiv({ cls: 'op-card-field-value op-project-field-value' });
			if (project.icon) {
				const icon = value.createSpan({ cls: 'op-project-field-icon' });
				if (/^[a-z0-9][a-z0-9-]*$/iu.test(project.icon)) setIcon(icon, project.icon);
				else icon.textContent = project.icon;
			}
			if (project.color) value.style.setProperty('--op-project-color', project.color);
			value.createSpan({ cls: 'op-project-field-text', text: `${project.code} · ${project.name}` });
		}
		else if (field === 'type') labeledField(flow, field, taskType?.name ?? metadata.taskTypeId, manager);
		else if (field === 'status') labeledField(flow, field, task.project.workflow.statuses.find((status) => status.id === metadata.statusId)?.name ?? metadata.statusId, manager);
		else if (field === 'reporter') personField(flow, field, metadata.reporterId, '未设置', manager, presentation('reporter'));
		else if (field === 'assignee') personField(flow, field, metadata.assigneeId, '未分配', manager, presentation('assignee'));
		else if (field === 'scheduledDate') labeledField(flow, field, displayDateTime(metadata.scheduledDate ?? null, '无计划日期'), manager, presentation('scheduledDate'));
		else if (field === 'dueDate') labeledField(flow, field, displayDateTime(metadata.dueDate, '无截止日期'), manager, presentation('dueDate'));
		else if (field === 'startDate') labeledField(flow, field, displayDateTime(metadata.startDate, '无开始日期'), manager, presentation('startDate'));
		else if (field === 'endDate') labeledField(flow, field, displayDateTime(metadata.endDate ?? null, '无结束日期'), manager, presentation('endDate'));
		else if (field === 'tags' && metadata.tags.length > 0) {
			const element = flow.createDiv({ cls: 'op-card-field is-tags' });
			applyValuePresentation(element, presentation('tags'));
			if (presentation('tags').color) element.style.setProperty('--op-tag-color', presentation('tags').color!);
			renderFieldLabel(element, TASK_DISPLAY_FIELD_LABELS.tags, presentation('tags'));
			renderTags(element, metadata.tags, manager);
		}
		else if (field === 'customFields') labeledField(flow, field, formatTaskCustomFields(task, manager), manager);
		else if (field.startsWith('custom:')) {
			const definition = task.project.customFields.find((item) => item.key === field.slice('custom:'.length));
			if (definition) labeledField(flow, field, formatCustomFieldValue(definition, metadata.custom[definition.key], manager.globalConfig.people), manager, presentation(field));
		}
		else if (field === 'relations' && task.document.relations.some((relation) => relation.type === 'related')) {
			const element = flow.createDiv({ cls: 'op-card-field is-relations' });
			applyValuePresentation(element, presentation('relations'));
			renderFieldLabel(element, TASK_DISPLAY_FIELD_LABELS.relations, presentation('relations'));
			const value = element.createDiv({ cls: 'op-card-field-value op-task-relation-list' });
			renderTaskRelations(value, task, manager);
		}
		else if (field === 'links') markdownField(flow, field, task.document.unknownLinks.join('\n\n'), task, manager, options, presentation('links'));
		else if (field === 'subtasks' && (task.document.subtasks ?? '').trim()) {
			const element = flow.createDiv({ cls: 'op-card-field is-subtasks' });
			applyValuePresentation(element, presentation('subtasks'));
			renderFieldLabel(element, taskDisplayFieldLabel(field), presentation('subtasks'));
			const value = element.createDiv({ cls: 'op-card-field-value' });
			renderEmbeddedSubtasks(value, task.document.subtasks ?? '', task, manager, options.component);
		}
	}
}

export function renderTaskListField(
	parent: HTMLElement,
	task: IndexedTask,
	manager: ProjectManager,
	field: TaskDisplayField,
	component: Component,
): void {
	const presentation = resolveTaskFieldPresentation(task, field);
	applyValuePresentation(parent, presentation);
	if (presentation.icon) applyLabelPresentation(parent, { icon: presentation.icon });
	const metadata = task.document.metadata;
	const taskType = task.project.taskTypes.find((type) => type.id === metadata.taskTypeId);
	if (field === 'key') {
		const key = parent.createSpan({ cls: 'op-task-key-cell' });
		renderTaskMarker(key, taskType);
		key.createSpan({ text: metadata.key });
	} else if (field === 'title') {
		const title = renderTaskTitle(parent, taskType, metadata.title, { tagName: 'span', showMarker: false });
		if (presentation.color) title.style.setProperty('--op-task-title-color', presentation.color);
	} else if (field === 'tags') renderTags(parent, metadata.tags, manager);
	else if (field === 'links') renderTaskMarkdownValue(parent, task.document.unknownLinks.join('\n\n'), task, manager, component);
	else if (field === 'subtasks') renderEmbeddedSubtasks(parent, task.document.subtasks ?? '', task, manager, component);
	else if (field === 'relations') renderTaskRelations(parent, task, manager);
	else if (field === 'priority') {
		const priority = renderTaskPriority(parent, metadata.priority, taskFieldOptions(taskType, 'priority'));
		if (presentation.color) priority.style.color = presentation.color;
	} else parent.setText(taskFieldText(task, manager, field));
}

function taskFieldText(task: IndexedTask, manager: ProjectManager, field: TaskDisplayField): string {
	const metadata = task.document.metadata;
	const person = (id: string | null) => manager.globalConfig.people.find((item) => item.id === id)?.name ?? '';
	if (field.startsWith('custom:')) {
		const definition = task.project.customFields.find((item) => item.key === field.slice('custom:'.length));
		return definition ? formatCustomFieldValue(definition, metadata.custom[definition.key], manager.globalConfig.people) : '';
	}
	const values: Partial<Record<TaskDisplayField, string>> = {
		project: `${task.project.code} · ${task.project.name}`,
		type: task.project.taskTypes.find((item) => item.id === metadata.taskTypeId)?.name ?? metadata.taskTypeId,
		status: task.project.workflow.statuses.find((item) => item.id === metadata.statusId)?.name ?? metadata.statusId,
		reporter: person(metadata.reporterId), assignee: person(metadata.assigneeId),
		scheduledDate: displayDateTime(metadata.scheduledDate ?? null), dueDate: displayDateTime(metadata.dueDate),
		startDate: displayDateTime(metadata.startDate), endDate: displayDateTime(metadata.endDate ?? null),
		customFields: formatTaskCustomFields(task, manager),
	};
	return values[field] ?? '';
}
