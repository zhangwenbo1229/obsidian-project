import type { BuiltInTaskDisplayField, CustomFieldDefinition, TaskDisplayField } from '../domain/types';

export type ProjectViewMode = 'list' | 'board' | 'calendar' | 'quadrants';

export interface ProjectViewDisplaySettings {
	list: TaskDisplayField[];
	board: TaskDisplayField[];
	calendar: TaskDisplayField[];
	quadrants: TaskDisplayField[];
}

export const TASK_DISPLAY_FIELDS: readonly BuiltInTaskDisplayField[] = [
	'key', 'title', 'project', 'type', 'status', 'priority',
	'reporter', 'assignee', 'startDate', 'dueDate', 'tags',
	'relations', 'links', 'subtasks',
];

export const TASK_DISPLAY_FIELD_LABELS: Record<BuiltInTaskDisplayField | 'customFields', string> = {
	key: '任务编号',
	title: '标题',
	project: '项目',
	type: '任务类型',
	status: '状态',
	priority: '优先级',
	reporter: '报告人',
	assignee: '经办人',
	startDate: '开始时间',
	dueDate: '截止时间',
	tags: '标签',
	customFields: '自定义字段',
	relations: '任务关系',
	links: '链接',
	subtasks: '子任务',
};

export const DEFAULT_PROJECT_VIEW_DISPLAY: ProjectViewDisplaySettings = {
	list: ['key', 'title', 'type', 'status', 'reporter', 'assignee', 'startDate', 'dueDate', 'customFields'],
	board: ['key', 'title', 'project', 'type', 'status', 'assignee', 'dueDate', 'tags'],
	calendar: ['key', 'title', 'project', 'type'],
	quadrants: ['key', 'title', 'project', 'type', 'priority', 'status', 'assignee', 'dueDate', 'tags'],
};

type DisplayCustomField = Pick<CustomFieldDefinition, 'key' | 'name'>;

export function taskDisplayFieldCatalog(customFields: readonly DisplayCustomField[] = []): Array<{ id: TaskDisplayField; label: string }> {
	return [
		...TASK_DISPLAY_FIELDS.map((id) => ({ id, label: TASK_DISPLAY_FIELD_LABELS[id] })),
		...customFields.map((field) => ({ id: `custom:${field.key}` as const, label: field.name })),
	];
}

export function taskDisplayFieldLabel(field: TaskDisplayField, customFields: readonly DisplayCustomField[] = []): string {
	if (field.startsWith('custom:')) {
		const key = field.slice('custom:'.length);
		return customFields.find((item) => item.key === key)?.name ?? key;
	}
	return TASK_DISPLAY_FIELD_LABELS[field as BuiltInTaskDisplayField | 'customFields'];
}

export function expandCustomDisplayFields(
	fields: readonly TaskDisplayField[],
	customFields: readonly DisplayCustomField[] = [],
): TaskDisplayField[] {
	return fields.flatMap((field) => field === 'customFields'
		? customFields.map((customField) => `custom:${customField.key}` as const)
		: [field]);
}

function normalizeFields(
	value: unknown,
	fallback: readonly TaskDisplayField[],
	customFields?: readonly DisplayCustomField[],
): TaskDisplayField[] {
	const source = Array.isArray(value) ? value : fallback;
	const allowed = new Set<TaskDisplayField>([
		...TASK_DISPLAY_FIELDS,
		'customFields',
		...(customFields ?? []).map((field) => `custom:${field.key}` as const),
	]);
	const normalized = [...new Set(source.filter((item): item is TaskDisplayField => allowed.has(item as TaskDisplayField)))];
	return customFields ? expandCustomDisplayFields(normalized, customFields) : normalized;
}

export function normalizeProjectViewDisplay(
	value?: Partial<ProjectViewDisplaySettings> | null,
	customFields?: readonly DisplayCustomField[],
): ProjectViewDisplaySettings {
	return {
		list: normalizeFields(value?.list, DEFAULT_PROJECT_VIEW_DISPLAY.list, customFields),
		board: normalizeFields(value?.board, DEFAULT_PROJECT_VIEW_DISPLAY.board, customFields),
		calendar: normalizeFields(value?.calendar, DEFAULT_PROJECT_VIEW_DISPLAY.calendar, customFields),
		quadrants: normalizeFields(value?.quadrants, DEFAULT_PROJECT_VIEW_DISPLAY.quadrants, customFields),
	};
}

export type { TaskDisplayField } from '../domain/types';
