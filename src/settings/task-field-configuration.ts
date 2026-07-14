import type {
	TaskFieldConfig,
	TaskFieldRule,
	TaskFormField,
	TaskTypeDefinition,
} from '../domain/types';

export const TASK_FORM_FIELDS: readonly TaskFormField[] = [
	'title', 'priority', 'reporter', 'assignee', 'startDate', 'dueDate', 'completedAt', 'terminatedAt', 'tags',
	'body', 'links', 'subtasks', 'relations', 'notes', 'customFields',
];

export const TASK_FORM_FIELD_LABELS: Record<TaskFormField, string> = {
	title: '标题',
	priority: '优先级',
	reporter: '提报人',
	assignee: '经办人',
	startDate: '开始时间',
	dueDate: '截止时间',
	completedAt: '完成时间',
	terminatedAt: '终止时间',
	tags: '标签',
	body: '任务正文',
	links: '链接',
	subtasks: '子任务',
	relations: '任务关系',
	notes: '备注',
	customFields: '自定义字段',
};

function defaultValue(field: TaskFormField): unknown {
	if (field === 'priority') return 'medium';
	if (field === 'tags') return [];
	if (field === 'assignee' || field === 'reporter') return null;
	if (field === 'startDate' || field === 'dueDate' || field === 'completedAt' || field === 'terminatedAt') return null;
	if (field === 'relations' || field === 'customFields') return undefined;
	return '';
}

export function normalizeTaskFieldConfig(value?: TaskFieldConfig | null): Record<TaskFormField, TaskFieldRule> {
	return Object.fromEntries(TASK_FORM_FIELDS.map((field) => {
		const configured = value?.[field];
		return [field, {
			enabled: configured?.enabled ?? true,
			required: configured?.required ?? false,
			defaultValue: configured?.defaultValue ?? defaultValue(field),
		}];
	})) as Record<TaskFormField, TaskFieldRule>;
}

export function taskFieldRule(type: TaskTypeDefinition | undefined, field: TaskFormField): TaskFieldRule {
	return normalizeTaskFieldConfig(type?.fieldConfig)[field];
}

export function taskFieldEnabled(type: TaskTypeDefinition | undefined, field: TaskFormField): boolean {
	return taskFieldRule(type, field).enabled;
}

export function taskFieldRequired(type: TaskTypeDefinition | undefined, field: TaskFormField): boolean {
	return taskFieldRule(type, field).required;
}

export function taskFieldDefault<T>(type: TaskTypeDefinition | undefined, field: TaskFormField): T | undefined {
	if (field === 'body' && type?.template !== undefined) return (type.template ?? '') as T;
	return taskFieldRule(type, field).defaultValue as T | undefined;
}
