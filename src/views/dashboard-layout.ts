import type {
	CustomFieldDefinition,
	DashboardCardKind,
	DashboardMetric,
	PersonalDashboardCardId,
	PersonalDashboardCardLayout,
	TaskDisplayField,
} from '../domain/types';
import { expandCustomDisplayFields, TASK_DISPLAY_FIELDS } from './task-display-settings';
import { DASHBOARD_MODULE_CATALOG, isDashboardModuleKind, normalizeDashboardModuleConfig } from './dashboard-modules/config';

const DEFAULT_LIST_FIELDS: TaskDisplayField[] = ['key', 'title', 'status', 'assignee', 'dueDate', 'tags'];

function filterDisplayFields(
	fields: readonly TaskDisplayField[],
	customFields?: readonly Pick<CustomFieldDefinition, 'key' | 'name'>[],
): TaskDisplayField[] {
	const allowed = new Set<TaskDisplayField>([
		...TASK_DISPLAY_FIELDS,
		'customFields',
		...(customFields ?? []).map((field) => `custom:${field.key}` as const),
	]);
	return [...new Set(fields.filter((field): field is TaskDisplayField => allowed.has(field as TaskDisplayField)))];
}

const DEFAULTS: Array<[PersonalDashboardCardId, number, number, DashboardCardKind, DashboardMetric]> = [
	['completed', 1, 1, 'number', 'completed'],
	['incomplete', 1, 1, 'number', 'incomplete'],
	['terminated', 1, 1, 'number', 'terminated'],
	['overdue-stat', 1, 1, 'number', 'overdue'],
	['completion-rate', 1, 1, 'percentage', 'completion-rate'],
	['overdue-list', 2, 3, 'task-list', 'overdue'],
	['pending-list', 2, 3, 'task-list', 'incomplete'],
];

const BUILT_IN_CARD_TITLES: Record<string, string> = {
	completed: '已完成', incomplete: '未完成', terminated: '已终止', 'overdue-stat': '已逾期',
	'completion-rate': '完成率', 'overdue-list': '当前逾期', 'pending-list': '待完成任务',
};

const CARD_KIND_TITLES: Partial<Record<DashboardCardKind, string>> = {
	number: '数字', percentage: '百分比', 'task-list': '项目', weather: '天气', calendar: '日历',
	date: '日期', todo: '待办', 'note-stats': '笔记统计', 'recent-files': '文件', news: '资讯',
	directory: '目录', text: '文本', chart: '图表', countdown: '倒计日', 'check-in': '打卡', heatmap: '热力图',
};

export const BUILT_IN_DASHBOARD_CARD_IDS = new Set(DEFAULTS.map(([id]) => id));

const DEFAULT_CARD_BACKGROUNDS: Record<DashboardMetric, string> = {
	total: '#6554c0',
	completed: '#22a06b',
	incomplete: '#0c66e4',
	terminated: '#6b778c',
	overdue: '#c9372c',
	'completion-rate': '#0c66e4',
	'overdue-rate': '#c9372c',
};

const DEFAULT_KIND_BACKGROUNDS: Partial<Record<DashboardCardKind, string>> = {
	'task-list': '#0c66e4',
	weather: '#2f9eeb',
	calendar: '#6554c0',
	'note-stats': '#22a06b',
	'recent-files': '#6b778c',
	news: '#c25100',
	directory: '#8f7ee7',
	text: '#0c66e4',
	chart: '#6554c0',
	'check-in': '#22a06b',
};

export function defaultDashboardCardBackground(metric: DashboardMetric, kind: DashboardCardKind = 'number'): string {
	return DEFAULT_KIND_BACKGROUNDS[kind] ?? DEFAULT_CARD_BACKGROUNDS[metric];
}

function normalizeCard(
	card: Partial<PersonalDashboardCardLayout> & Pick<PersonalDashboardCardLayout, 'id'>,
	defaults: { order: number; columnSpan: number; rowSpan: number; kind: DashboardCardKind; metric: DashboardMetric },
	customFields?: readonly Pick<CustomFieldDefinition, 'key' | 'name'>[],
): PersonalDashboardCardLayout {
	const kind = card.kind ?? defaults.kind;
	const metric = card.metric ?? defaults.metric;
	const columnSpan = Math.min(8, Math.max(1, card.columnSpan ?? defaults.columnSpan));
	return {
		id: card.id,
		order: Number.isFinite(card.order) ? card.order! : defaults.order,
		columnSpan,
		columnStart: Number.isFinite(card.columnStart) ? Math.min(8 - columnSpan + 1, Math.max(1, Math.round(card.columnStart!))) : undefined,
		rowStart: Number.isFinite(card.rowStart) ? Math.max(1, Math.round(card.rowStart!)) : undefined,
		rowSpan: Math.min(6, Math.max(1, card.rowSpan ?? defaults.rowSpan)),
		filterId: card.filterId ?? null,
		kind,
		metric,
		displayFields: filterDisplayFields(expandCustomDisplayFields(card.displayFields?.length ? card.displayFields : DEFAULT_LIST_FIELDS, customFields), customFields),
		taskListDirection: card.taskListDirection === 'vertical' ? 'vertical' : 'horizontal',
		title: card.title?.trim() || undefined,
		numberColor: card.numberColor?.trim() || undefined,
		backgroundColor: card.backgroundColor?.trim() || defaultDashboardCardBackground(metric, kind),
		fontSize: Number.isFinite(card.fontSize) ? Math.min(40, Math.max(8, Math.round(card.fontSize!))) : 14,
		percentageDataMode: card.percentageDataMode === 'manual' || card.percentageDataMode === 'direct' ? card.percentageDataMode : 'task',
		percentageCurrent: Number.isFinite(card.percentageCurrent) ? Math.max(0, card.percentageCurrent!) : 0,
		percentageTarget: Number.isFinite(card.percentageTarget) && card.percentageTarget! > 0 ? card.percentageTarget! : 100,
		percentageValue: Number.isFinite(card.percentageValue) ? Math.min(100, Math.max(0, card.percentageValue!)) : 0,
		percentageDisplay: card.percentageDisplay === 'progress' ? 'progress' : 'number',
		percentageProgressStyle: card.percentageProgressStyle === 'semicircle' ? 'semicircle' : 'linear',
		moduleConfig: isDashboardModuleKind(kind) ? normalizeDashboardModuleConfig(kind, card.moduleConfig) : undefined,
	};
}

export function normalizeDashboardLayout(
	layout: readonly PersonalDashboardCardLayout[],
	customFields?: readonly Pick<CustomFieldDefinition, 'key' | 'name'>[],
): PersonalDashboardCardLayout[] {
	const existing = new Map(layout.map((card) => [card.id, card]));
	const builtIns = DEFAULTS.map(([id, columnSpan, rowSpan, kind, metric], order) => {
		const card = existing.get(id);
		return normalizeCard(card ?? { id }, { order, columnSpan, rowSpan, kind, metric }, customFields);
	});
	const custom = layout
		.filter((card) => !BUILT_IN_DASHBOARD_CARD_IDS.has(card.id))
		.map((card, index) => normalizeCard(card, {
			order: DEFAULTS.length + index,
			columnSpan: card.kind === 'task-list' ? 2 : 1,
			rowSpan: card.kind === 'task-list' ? 3 : 1,
			kind: card.kind ?? 'number',
			metric: card.metric ?? 'total',
		}, customFields));
	return [...builtIns, ...custom]
		.sort((left, right) => left.order - right.order)
		.map((card, order) => ({ ...card, order }));
}

export function createDashboardCard(
	id: string,
	kind: DashboardCardKind,
	order: number,
): PersonalDashboardCardLayout {
	const module = isDashboardModuleKind(kind)
		? DASHBOARD_MODULE_CATALOG.find((item) => item.kind === kind)
		: undefined;
	return normalizeCard({ id, kind }, {
		order,
		columnSpan: module?.defaultSize.columns ?? (kind === 'task-list' ? 2 : 1),
		rowSpan: module?.defaultSize.rows ?? (kind === 'task-list' ? 3 : 1),
		kind,
		metric: kind === 'percentage' ? 'completion-rate' : 'total',
	});
}

export function updateDashboardCard(
	layout: readonly PersonalDashboardCardLayout[],
	cardId: PersonalDashboardCardId,
	patch: Partial<Omit<PersonalDashboardCardLayout, 'id'>>,
): PersonalDashboardCardLayout[] {
	return normalizeDashboardLayout(layout).map((card) => card.id === cardId ? { ...card, ...patch, id: card.id } : card);
}

export function deleteDashboardCard(
	layout: readonly PersonalDashboardCardLayout[],
	cardId: PersonalDashboardCardId,
): PersonalDashboardCardLayout[] {
	return normalizeDashboardLayout(layout)
		.filter((card) => card.id !== cardId)
		.map((card, order) => ({ ...card, order }));
}

export function reorderDashboardCards(
	layout: readonly PersonalDashboardCardLayout[],
	draggedId: PersonalDashboardCardId,
	targetId: PersonalDashboardCardId,
): PersonalDashboardCardLayout[] {
	const cards = normalizeDashboardLayout(layout).filter((card) => card.id !== draggedId);
	const dragged = normalizeDashboardLayout(layout).find((card) => card.id === draggedId)!;
	const targetIndex = cards.findIndex((card) => card.id === targetId);
	cards.splice(targetIndex < 0 ? cards.length : targetIndex, 0, dragged);
	return cards.map((card, order) => ({ ...card, order }));
}

export function resizeDashboardCard(
	layout: readonly PersonalDashboardCardLayout[],
	cardId: PersonalDashboardCardId,
	columnSpan: number,
	rowSpan: number,
): PersonalDashboardCardLayout[] {
	return normalizeDashboardLayout(layout).map((card) => card.id === cardId ? {
		...card,
		columnSpan: Math.min(8, Math.max(1, Math.round(columnSpan))),
		rowSpan: Math.min(6, Math.max(1, Math.round(rowSpan))),
	} : card);
}

export function moveDashboardCard(
	layout: readonly PersonalDashboardCardLayout[],
	cardId: PersonalDashboardCardId,
	columnStart: number,
	rowStart: number,
): PersonalDashboardCardLayout[] {
	const cards = normalizeDashboardLayout(layout);
	const moving = cards.find((card) => card.id === cardId);
	if (!moving) return cards;
	const column = Math.min(8 - moving.columnSpan + 1, Math.max(1, Math.round(columnStart)));
	let row = Math.max(1, Math.round(rowStart));
	const overlaps = (candidateRow: number, card: PersonalDashboardCardLayout) => {
		if (card.id === cardId || card.columnStart === undefined || card.rowStart === undefined) return false;
		return column < card.columnStart + card.columnSpan
			&& column + moving.columnSpan > card.columnStart
			&& candidateRow < card.rowStart + card.rowSpan
			&& candidateRow + moving.rowSpan > card.rowStart;
	};
	while (cards.some((card) => overlaps(row, card))) row += 1;
	return cards.map((card) => card.id === cardId ? { ...card, columnStart: column, rowStart: row } : card);
}

export function bindDashboardFilter(
	layout: readonly PersonalDashboardCardLayout[],
	cardId: PersonalDashboardCardId,
	filterId: string | null,
): PersonalDashboardCardLayout[] {
	return normalizeDashboardLayout(layout).map((card) => card.id === cardId ? { ...card, filterId } : card);
}

export function duplicateDashboardCard(
	layout: readonly PersonalDashboardCardLayout[],
	sourceId: PersonalDashboardCardId,
	newId: PersonalDashboardCardId,
): PersonalDashboardCardLayout[] {
	const normalized = normalizeDashboardLayout(layout);
	const sourceIndex = normalized.findIndex((card) => card.id === sourceId);
	if (sourceIndex < 0 || normalized.some((card) => card.id === newId)) return normalized;
	const copy = structuredClone(normalized[sourceIndex]!);
	copy.id = newId;
	copy.title = `${copy.title ?? BUILT_IN_CARD_TITLES[sourceId] ?? CARD_KIND_TITLES[copy.kind] ?? '自定义卡片'} 副本`;
	normalized.splice(sourceIndex + 1, 0, copy);
	return normalized.map((card, order) => ({ ...card, order }));
}

export function updateDashboardCardPresentation(
	layout: readonly PersonalDashboardCardLayout[],
	cardId: PersonalDashboardCardId,
	presentation: Pick<PersonalDashboardCardLayout, 'title' | 'numberColor' | 'backgroundColor'>,
): PersonalDashboardCardLayout[] {
	return normalizeDashboardLayout(layout).map((card) => card.id === cardId ? {
		...card,
		title: presentation.title?.trim() || undefined,
		numberColor: presentation.numberColor?.trim() || undefined,
		backgroundColor: presentation.backgroundColor?.trim() || undefined,
	} : card);
}

export function calculateDashboardResizePreview(
	columnSpan: number,
	rowSpan: number,
	deltaX: number,
	deltaY: number,
	columnUnit: number,
	rowUnit: number,
): Pick<PersonalDashboardCardLayout, 'columnSpan' | 'rowSpan'> {
	return {
		columnSpan: Math.min(8, Math.max(1, columnSpan + Math.round(deltaX / Math.max(1, columnUnit)))),
		rowSpan: Math.min(6, Math.max(1, rowSpan + Math.round(deltaY / Math.max(1, rowUnit)))),
	};
}
