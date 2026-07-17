import type {
	CustomFieldOption,
	TaskFieldConfig,
	TaskFieldRule,
	TaskFormField,
	TaskTypeDefinition,
} from '../domain/types';

export const DEFAULT_PROJECT_PRIORITY_OPTIONS: readonly CustomFieldOption[] = [
	{ id: 'high', name: '高' },
	{ id: 'medium', name: '中' },
	{ id: 'low', name: '低' },
];

export const TASK_FORM_FIELDS: readonly TaskFormField[] = [
	'title', 'priority', 'reporter', 'assignee', 'scheduledDate', 'dueDate', 'startDate', 'endDate', 'tags',
	'body', 'links', 'subtasks', 'relations', 'notes', 'customFields',
];

export const TASK_FORM_FIELD_LABELS: Record<TaskFormField, string> = {
	title: '标题',
	priority: '优先级',
	reporter: '提报人',
	assignee: '经办人',
	scheduledDate: '计划日期',
	dueDate: '截止日期',
	startDate: '开始日期',
	endDate: '结束日期',
	tags: '标签',
	body: '项目描述',
	links: '链接',
	subtasks: '任务',
	relations: '项目关系',
	notes: '备注',
	customFields: '自定义字段',
};

function defaultValue(field: TaskFormField): unknown {
	if (field === 'priority') return 'medium';
	if (field === 'tags') return [];
	if (field === 'assignee' || field === 'reporter') return null;
	if (field === 'scheduledDate' || field === 'startDate' || field === 'dueDate' || field === 'endDate') return null;
	if (field === 'relations' || field === 'customFields') return undefined;
	return '';
}

function normalizePriorityOptions(value: readonly CustomFieldOption[] | undefined): CustomFieldOption[] {
	const normalized = [...new Map((value ?? []).flatMap((option) => {
		const id = option.id.trim();
		const name = option.name.trim();
		return id && name ? [[id, { id, name }] as const] : [];
	})).values()];
	return normalized.length > 0 ? normalized : DEFAULT_PROJECT_PRIORITY_OPTIONS.map((option) => ({ ...option }));
}

export function normalizeTaskFieldConfig(value?: TaskFieldConfig | null): Record<TaskFormField, TaskFieldRule> {
	return Object.fromEntries(TASK_FORM_FIELDS.map((field) => {
		const configured = value?.[field];
		const options = field === 'priority' ? normalizePriorityOptions(configured?.options) : undefined;
		const configuredDefault = configured?.defaultValue ?? defaultValue(field);
		return [field, {
			enabled: configured?.enabled ?? true,
			required: configured?.required ?? false,
			defaultValue: field === 'priority' && !options?.some((option) => option.id === configuredDefault)
				? options?.[0]?.id ?? 'medium'
				: configuredDefault,
			icon: configured?.icon?.trim() || undefined,
			color: configured?.color && /^#[0-9a-f]{6}$/iu.test(configured.color.trim())
				? configured.color.trim().toLowerCase()
				: undefined,
			options,
		}];
	})) as Record<TaskFormField, TaskFieldRule>;
}

export function taskFieldOptions(
	type: TaskTypeDefinition | undefined,
	field: TaskFormField,
): CustomFieldOption[] {
	return field === 'priority'
		? structuredClone(normalizeTaskFieldConfig(type?.fieldConfig).priority.options ?? DEFAULT_PROJECT_PRIORITY_OPTIONS.map((option) => ({ ...option })))
		: [];
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
