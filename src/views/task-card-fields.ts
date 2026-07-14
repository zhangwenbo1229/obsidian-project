import { Component, MarkdownRenderer } from 'obsidian';
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

export interface TaskCardFieldOptions {
	titleClassName?: string;
	compact?: boolean;
	component: Component;
	markerBeforeKey?: boolean;
	priorityInCorner?: boolean;
	keyTitleInline?: boolean;
}

function personName(manager: ProjectManager, id: string | null, fallback: string): string {
	return manager.globalConfig.people.find((person) => person.id === id)?.name ?? fallback;
}

function labeledField(parent: HTMLElement, field: TaskDisplayField, value: string, manager: ProjectManager): void {
	if (!value) return;
	const className = field.startsWith('custom:') ? 'custom' : field;
	const element = parent.createDiv({ cls: `op-card-field is-${className}` });
	element.createSpan({ cls: 'op-card-field-label', text: taskDisplayFieldLabel(field, taskCustomFields(manager)) });
	element.createSpan({ cls: 'op-card-field-value', text: value });
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
): void {
	if (!value.trim()) return;
	const element = parent.createDiv({ cls: `op-card-field is-${field}` });
	element.createSpan({ cls: 'op-card-field-label', text: taskDisplayFieldLabel(field) });
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
	const renderKey = (container: HTMLElement) => {
		const key = container.createSpan({ cls: 'op-task-key' });
		if (options.markerBeforeKey) renderTaskMarker(key, taskType);
		key.createSpan({ text: metadata.key });
	};
	const renderTitle = (container: HTMLElement) => renderTaskTitle(container, taskType, metadata.title, {
		className: options.titleClassName ?? 'op-task-card-title',
		showMarker: !options.markerBeforeKey,
	});
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
			if (!options.priorityInCorner) wrapper.createSpan({ cls: 'op-card-field-label', text: TASK_DISPLAY_FIELD_LABELS.priority });
			renderTaskPriority(wrapper, metadata.priority);
		}
		else if (field === 'project') labeledField(flow, field, `${task.project.code} · ${task.project.name}`, manager);
		else if (field === 'type') labeledField(flow, field, taskType?.name ?? metadata.taskTypeId, manager);
		else if (field === 'status') labeledField(flow, field, task.project.workflow.statuses.find((status) => status.id === metadata.statusId)?.name ?? metadata.statusId, manager);
		else if (field === 'reporter') labeledField(flow, field, personName(manager, metadata.reporterId, '未设置'), manager);
		else if (field === 'assignee') labeledField(flow, field, personName(manager, metadata.assigneeId, '未分配'), manager);
		else if (field === 'startDate') labeledField(flow, field, displayDateTime(metadata.startDate, '无开始时间'), manager);
		else if (field === 'dueDate') labeledField(flow, field, displayDateTime(metadata.dueDate, '无计划日期'), manager);
		else if (field === 'tags' && metadata.tags.length > 0) {
			const element = flow.createDiv({ cls: 'op-card-field is-tags' });
			element.createSpan({ cls: 'op-card-field-label', text: TASK_DISPLAY_FIELD_LABELS.tags });
			renderTags(element, metadata.tags, manager);
		}
		else if (field === 'customFields') labeledField(flow, field, formatTaskCustomFields(task, manager), manager);
		else if (field.startsWith('custom:')) {
			const definition = task.project.customFields.find((item) => item.key === field.slice('custom:'.length));
			if (definition) labeledField(flow, field, formatCustomFieldValue(definition, metadata.custom[definition.key], manager.globalConfig.people), manager);
		}
		else if (field === 'relations' && task.document.relations.some((relation) => relation.type === 'related')) {
			const element = flow.createDiv({ cls: 'op-card-field is-relations' });
			element.createSpan({ cls: 'op-card-field-label', text: TASK_DISPLAY_FIELD_LABELS.relations });
			const value = element.createDiv({ cls: 'op-card-field-value op-task-relation-list' });
			renderTaskRelations(value, task, manager);
		}
		else if (field === 'links') markdownField(flow, field, task.document.unknownLinks.join('\n\n'), task, manager, options);
		else if (field === 'subtasks') markdownField(flow, field, task.document.subtasks ?? '', task, manager, options);
	}
}
