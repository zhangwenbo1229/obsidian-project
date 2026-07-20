import type { TaskDisplayField, TaskFormField } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
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
	manager?: ProjectManager,
): FieldPresentation {
	// 优先从统一元数据池读取 color/icon（受元数据管理控制）
	const unifiedPool = manager?.globalConfig.unifiedMetadataFields ?? [];
	const unifiedByKey = new Map(unifiedPool.map((f) => [f.key, f]));
	// custom:xxx 字段去掉前缀查找
	const lookupKey = field.startsWith('custom:') ? field.slice('custom:'.length) : field;
	const unified = unifiedByKey.get(lookupKey);

	if (field.startsWith('custom:')) {
		const definition = (task.project.customFields ?? []).find((item) => item.key === field.slice('custom:'.length));
		return {
			icon: unified?.icon ?? definition?.icon,
			color: unified?.color ?? definition?.color,
		};
	}
	const taskType = task.project.taskTypes.find((type) => type.id === task.document.metadata.taskTypeId);
	const formField = DISPLAY_TO_FORM_FIELD[field];
	const rule = formField ? taskFieldRule(taskType, formField) : undefined;
	return {
		icon: unified?.icon ?? rule?.icon,
		color: unified?.color ?? rule?.color ?? (field === 'title' ? taskType?.titleColor : undefined),
	};
}
