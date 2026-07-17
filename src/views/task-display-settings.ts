import type { BuiltInTaskDisplayField, CustomFieldDefinition, ProjectPriority, StatusCategory, TaskDisplayField, WorkflowStatus } from '../domain/types';

export type ProjectViewMode = 'list' | 'board' | 'calendar' | 'quadrants';
export type CalendarDateSource = 'planned-range' | 'execution-range' | 'scheduledDate' | 'dueDate' | 'startDate' | 'endDate';

export interface ProjectViewBehaviorSettings {
	board: {
		groupStatusIds: Record<StatusCategory, string[]>;
		showCompletedColumn: boolean;
		autoUpdateStatusOnDrop: boolean;
	};
	calendar: {
		dateSource: CalendarDateSource;
		autoUpdateDateOnDrop: boolean;
	};
	quadrants: {
		importantPriorities: ProjectPriority[];
		urgentWithinDays: number;
	};
}

export interface ProjectViewDisplaySettings {
	list: TaskDisplayField[];
	board: TaskDisplayField[];
	calendar: TaskDisplayField[];
	quadrants: TaskDisplayField[];
	behavior: ProjectViewBehaviorSettings;
}

export const TASK_DISPLAY_FIELDS: readonly BuiltInTaskDisplayField[] = [
	'key', 'title', 'project', 'type', 'status', 'priority',
	'reporter', 'assignee', 'scheduledDate', 'dueDate', 'startDate', 'endDate', 'tags',
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
	scheduledDate: '计划日期',
	dueDate: '截止日期',
	startDate: '开始日期',
	endDate: '结束日期',
	tags: '标签',
	customFields: '自定义字段',
	relations: '任务关系',
	links: '链接',
	subtasks: '任务',
};

export const DEFAULT_PROJECT_VIEW_DISPLAY: ProjectViewDisplaySettings = {
	list: ['key', 'title', 'type', 'status', 'reporter', 'assignee', 'scheduledDate', 'dueDate', 'startDate', 'endDate', 'customFields'],
	board: ['key', 'title', 'project', 'type', 'status', 'assignee', 'scheduledDate', 'dueDate', 'tags'],
	calendar: ['key', 'title', 'project', 'type'],
	quadrants: ['key', 'title', 'project', 'type', 'priority', 'status', 'assignee', 'scheduledDate', 'dueDate', 'tags'],
	behavior: {
		board: { groupStatusIds: { todo: [], in_progress: [], done: [] }, showCompletedColumn: true, autoUpdateStatusOnDrop: true },
		calendar: { dateSource: 'planned-range', autoUpdateDateOnDrop: false },
		quadrants: { importantPriorities: ['high'], urgentWithinDays: 3 },
	},
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
	workflowStatuses: readonly Pick<WorkflowStatus, 'id' | 'category'>[] = [],
): ProjectViewDisplaySettings {
	const behavior = value?.behavior;
	const board = behavior?.board;
	const groupStatusIds = board?.groupStatusIds;
	const assignedStatusIds = new Set((['todo', 'in_progress', 'done'] as const).flatMap((category) =>
		Array.isArray(groupStatusIds?.[category]) ? groupStatusIds[category] : [],
	));
	const normalizeStatusIds = (category: StatusCategory) => [
		...(Array.isArray(groupStatusIds?.[category])
			? [...new Set(groupStatusIds[category].filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map((id) => id.trim()))]
			: []),
		...workflowStatuses.filter((status) => status.category === category && !assignedStatusIds.has(status.id)).map((status) => status.id),
	];
	const calendarSource = behavior?.calendar?.dateSource;
	const allowedDateSources = new Set<CalendarDateSource>(['planned-range', 'execution-range', 'scheduledDate', 'dueDate', 'startDate', 'endDate']);
	const importantPriorities = Array.isArray(behavior?.quadrants?.importantPriorities)
		? [...new Set(behavior.quadrants.importantPriorities.filter((priority): priority is ProjectPriority => typeof priority === 'string' && Boolean(priority.trim())).map((priority) => priority.trim()))]
		: ['high'] as ProjectPriority[];
	const urgentWithinDays = behavior?.quadrants?.urgentWithinDays;
	return {
		list: normalizeFields(value?.list, DEFAULT_PROJECT_VIEW_DISPLAY.list, customFields),
		board: normalizeFields(value?.board, DEFAULT_PROJECT_VIEW_DISPLAY.board, customFields),
		calendar: normalizeFields(value?.calendar, DEFAULT_PROJECT_VIEW_DISPLAY.calendar, customFields),
		quadrants: normalizeFields(value?.quadrants, DEFAULT_PROJECT_VIEW_DISPLAY.quadrants, customFields),
		behavior: {
			board: {
				groupStatusIds: { todo: normalizeStatusIds('todo'), in_progress: normalizeStatusIds('in_progress'), done: normalizeStatusIds('done') },
				showCompletedColumn: board?.showCompletedColumn !== false,
				autoUpdateStatusOnDrop: board?.autoUpdateStatusOnDrop !== false,
			},
			calendar: {
				dateSource: typeof calendarSource === 'string' && allowedDateSources.has(calendarSource)
					? calendarSource : 'planned-range',
				autoUpdateDateOnDrop: behavior?.calendar?.autoUpdateDateOnDrop === true,
			},
			quadrants: {
				importantPriorities,
				urgentWithinDays: typeof urgentWithinDays === 'number' && Number.isFinite(urgentWithinDays)
					? Math.min(365, Math.max(0, Math.round(urgentWithinDays))) : 3,
			},
		},
	};
}

export type { TaskDisplayField } from '../domain/types';
