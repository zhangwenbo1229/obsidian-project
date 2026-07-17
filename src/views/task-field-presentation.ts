import type { TaskDisplayField, TaskFormField } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import { taskFieldRule } from '../settings/task-field-configuration';
import type { FieldPresentation } from './field-presentation';

const DISPLAY_TO_FORM_FIELD: Partial<Record<TaskDisplayField, TaskFormField>> = {
	title: 'title',
	priority: 'priority',
	reporter: 'reporter',
	assignee: 'assignee',
	scheduledDate: 'scheduledDate',
	startDate: 'startDate',
	dueDate: 'dueDate',
	endDate: 'endDate',
	tags: 'tags',
	relations: 'relations',
	links: 'links',
	subtasks: 'subtasks',
};

export function resolveTaskFieldPresentation(
	task: IndexedTask,
	field: TaskDisplayField,
): FieldPresentation {
	if (field.startsWith('custom:')) {
		const definition = task.project.customFields.find((item) => item.key === field.slice('custom:'.length));
		return { icon: definition?.icon, color: definition?.color };
	}
	const taskType = task.project.taskTypes.find((type) => type.id === task.document.metadata.taskTypeId);
	const formField = DISPLAY_TO_FORM_FIELD[field];
	const rule = formField ? taskFieldRule(taskType, formField) : undefined;
	return {
		icon: rule?.icon,
		color: rule?.color ?? (field === 'title' ? taskType?.titleColor : undefined),
	};
}
