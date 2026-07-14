import type {
	CustomFieldDefinition,
	DashboardCardKind,
	DashboardMetric,
	PersonalDashboardCardId,
	PersonalDashboardCardLayout,
	TaskDisplayField,
} from '../domain/types';
import { expandCustomDisplayFields } from './task-display-settings';
import { DASHBOARD_MODULE_CATALOG, isDashboardModuleKind, normalizeDashboardModuleConfig } from './dashboard-modules/config';

const DEFAULT_LIST_FIELDS: TaskDisplayField[] = ['key', 'title', 'status', 'assignee', 'dueDate', 'tags'];

const DEFAULTS: Array<[PersonalDashboardCardId, number, number, DashboardCardKind, DashboardMetric]> = [
	['completed', 1, 1, 'number', 'completed'],
	['incomplete', 1, 1, 'number', 'incomplete'],
	['terminated', 1, 1, 'number', 'terminated'],
	['overdue-stat', 1, 1, 'number', 'overdue'],
	['completion-rate', 1, 1, 'percentage', 'completion-rate'],
	['overdue-list', 2, 3, 'task-list', 'overdue'],
	['pending-list', 2, 3, 'task-list', 'incomplete'],
];

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
	return {
		id: card.id,
		order: Number.isFinite(card.order) ? card.order! : defaults.order,
		columnSpan: Math.min(4, Math.max(1, card.columnSpan ?? defaults.columnSpan)),
		rowSpan: Math.min(6, Math.max(1, card.rowSpan ?? defaults.rowSpan)),
		filterId: card.filterId ?? null,
		kind,
		metric,
		displayFields: expandCustomDisplayFields(card.displayFields?.length ? card.displayFields : DEFAULT_LIST_FIELDS, customFields),
		taskListDirection: card.taskListDirection === 'vertical' ? 'vertical' : 'horizontal',
		title: card.title?.trim() || undefined,
		numberColor: card.numberColor?.trim() || undefined,
		backgroundColor: card.backgroundColor?.trim() || defaultDashboardCardBackground(metric, kind),
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
		.filter((card) => card.id !== cardId || BUILT_IN_DASHBOARD_CARD_IDS.has(card.id))
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
		columnSpan: Math.min(4, Math.max(1, Math.round(columnSpan))),
		rowSpan: Math.min(6, Math.max(1, Math.round(rowSpan))),
	} : card);
}

export function bindDashboardFilter(
	layout: readonly PersonalDashboardCardLayout[],
	cardId: PersonalDashboardCardId,
	filterId: string | null,
): PersonalDashboardCardLayout[] {
	return normalizeDashboardLayout(layout).map((card) => card.id === cardId ? { ...card, filterId } : card);
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
		columnSpan: Math.min(4, Math.max(1, columnSpan + Math.round(deltaX / Math.max(1, columnUnit)))),
		rowSpan: Math.min(6, Math.max(1, rowSpan + Math.round(deltaY / Math.max(1, rowUnit)))),
	};
}
