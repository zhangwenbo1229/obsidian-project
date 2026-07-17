import { Notice } from 'obsidian';
import type { EmbeddedSubtask } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import type { TaskMetadataDisplayField } from '../settings/task-metadata-settings';
import type { TaskViewItem } from './task-view-model';

const EDITABLE_FIELDS = new Set<TaskMetadataDisplayField>([
	'scheduledDate', 'dueDate', 'startDate', 'doneDate',
]);

export function isInlineEditableTaskMetadata(field: string): field is TaskMetadataDisplayField {
	return EDITABLE_FIELDS.has(field as TaskMetadataDisplayField);
}

export function applyTaskMetadataEditorValue(
	task: EmbeddedSubtask,
	field: TaskMetadataDisplayField,
	value: string,
): EmbeddedSubtask {
	if (!isInlineEditableTaskMetadata(field)) return task;
	return { ...task, [field]: value || null };
}

function embeddedSubtask(item: TaskViewItem): EmbeddedSubtask | null {
	if (item.kind !== 'structured' || !item.taskId) return null;
	return {
		id: item.taskId,
		title: item.title,
		completed: item.completed,
		priority: item.priority === 'normal' ? 'medium' : item.priority,
		tags: item.tags,
		scheduledDate: item.scheduledDate,
		startDate: item.startDate,
		dueDate: item.dueDate,
		createdDate: item.createdDate,
		doneDate: item.doneDate,
		cancelledDate: item.cancelledDate,
		custom: item.custom,
	};
}

function editorValue(task: EmbeddedSubtask, field: TaskMetadataDisplayField): string {
	const value = task[field as keyof EmbeddedSubtask];
	return typeof value === 'string' ? value.slice(0, 10) : '';
}

export function editTaskMetadataInline(
	target: HTMLElement,
	item: TaskViewItem,
	field: TaskMetadataDisplayField,
	manager: ProjectManager,
): void {
	const task = embeddedSubtask(item);
	if (!task || !isInlineEditableTaskMetadata(field) || target.hasClass('is-editing')) return;
	const previousChildren = Array.from(target.childNodes);
	target.empty();
	target.addClass('is-editing');
	const control = target.createEl('input', {
			cls: 'op-task-metadata-inline-editor',
			attr: { type: 'date', 'aria-label': '编辑任务元数据' },
		});
	control.value = editorValue(task, field);
	control.focus();
	control.select();
	let finished = false;
	const restore = () => {
		if (finished) return;
		finished = true;
		target.empty();
		target.append(...previousChildren);
		target.removeClass('is-editing');
	};
	const save = async () => {
		if (finished) return;
		finished = true;
		control.disabled = true;
		try {
			await manager.updateEmbeddedSubtask(item.parent, applyTaskMetadataEditorValue(task, field, control.value));
		} catch (error) {
			finished = false;
			control.disabled = false;
			control.focus();
			new Notice(error instanceof Error ? error.message : String(error));
		}
	};
	control.addEventListener('click', (event) => event.stopPropagation());
	control.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') { event.preventDefault(); restore(); }
		else if (event.key === 'Enter') { event.preventDefault(); void save(); }
	});
	control.addEventListener('change', () => void save());
	control.addEventListener('blur', () => void save());
}
