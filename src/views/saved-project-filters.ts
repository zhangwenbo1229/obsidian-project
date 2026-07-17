import type { ProjectFilterDefinition } from '../domain/types';
import type { ProjectFilters } from './selectors';

const SET_FIELDS = [
	'statusIds',
	'taskTypeIds',
	'reporterIds',
	'assigneeIds',
	'tags',
	'statusCategories',
] as const;

export function serializeProjectFilter(filters: ProjectFilters): ProjectFilterDefinition {
	const serialized: ProjectFilterDefinition = {
		projectUid: filters.projectUid,
		keyword: filters.keyword,
		createdAtFrom: filters.createdAtFrom,
		createdAtTo: filters.createdAtTo,
		scheduledDateFrom: filters.scheduledDateFrom,
		scheduledDateTo: filters.scheduledDateTo,
		startDateFrom: filters.startDateFrom,
		startDateTo: filters.startDateTo,
		dueDateFrom: filters.dueDateFrom,
		dueDateTo: filters.dueDateTo,
		endDateFrom: filters.endDateFrom,
		endDateTo: filters.endDateTo,
		completedAtFrom: filters.completedAtFrom,
		completedAtTo: filters.completedAtTo,
		hasIncompleteSubtasks: filters.hasIncompleteSubtasks || undefined,
	};
	for (const field of SET_FIELDS) {
		const value = filters[field];
		if (value && value.size > 0) serialized[field] = [...value];
	}
	const customFields = Object.fromEntries(
		Object.entries(filters.customFields ?? {})
			.filter(([, values]) => values.size > 0)
			.map(([key, values]) => [key, [...values]]),
	);
	if (Object.keys(customFields).length > 0) serialized.customFields = customFields;
	return serialized;
}

export function restoreProjectFilter(filters: ProjectFilterDefinition): ProjectFilters {
	const restored: ProjectFilters = {
		projectUid: filters.projectUid,
		keyword: filters.keyword,
		createdAtFrom: filters.createdAtFrom,
		createdAtTo: filters.createdAtTo,
		scheduledDateFrom: filters.scheduledDateFrom,
		scheduledDateTo: filters.scheduledDateTo,
		startDateFrom: filters.startDateFrom,
		startDateTo: filters.startDateTo,
		dueDateFrom: filters.dueDateFrom,
		dueDateTo: filters.dueDateTo,
		endDateFrom: filters.endDateFrom,
		endDateTo: filters.endDateTo,
		completedAtFrom: filters.completedAtFrom,
		completedAtTo: filters.completedAtTo,
		hasIncompleteSubtasks: filters.hasIncompleteSubtasks,
	};
	for (const field of SET_FIELDS) restored[field] = new Set(filters[field] ?? []);
	restored.customFields = Object.fromEntries(
		Object.entries(filters.customFields ?? {}).map(([key, values]) => [key, new Set(values)]),
	);
	return restored;
}

export function validateSavedFilterName(name: string): string {
	const normalized = name.trim();
	if (!normalized) throw new Error('筛选器名称不能为空。');
	if (normalized.length > 60) throw new Error('筛选器名称不能超过 60 个字符。');
	return normalized;
}
