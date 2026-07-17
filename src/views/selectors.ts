import type { IndexedTask, TaskStatistics } from '../index/task-index';
import type { ProjectPriority } from '../domain/types';
import { datePart } from '../utils/dates';
import type { CalendarDateSource } from './task-display-settings';

export const ALL_PROJECTS_UID = '*';

export type PersonalStartPeriod = 'all' | 'today' | 'week' | 'month';

export interface PersonalFilters {
	startPeriod: PersonalStartPeriod;
	tags: ReadonlySet<string>;
}

export interface TagTreeNode {
	name: string;
	path: string;
	children: TagTreeNode[];
}

export function buildTagTree(tags: readonly string[], order: readonly string[] = []): TagTreeNode[] {
	const roots: TagTreeNode[] = [];
	for (const tag of [...new Set(tags.map((item) => item.trim()).filter(Boolean))]) {
		let nodes = roots;
		let path = '';
		for (const name of tag.split('/').filter(Boolean)) {
			path = path ? `${path}/${name}` : name;
			let node = nodes.find((item) => item.name === name);
			if (!node) {
				node = { name, path, children: [] };
				nodes.push(node);
			}
			nodes = node.children;
		}
	}
	const rank = new Map(order.map((path, index) => [path, index]));
	const sort = (nodes: TagTreeNode[]) => {
		nodes.sort((left, right) => {
			const leftRank = rank.get(left.path) ?? Number.MAX_SAFE_INTEGER;
			const rightRank = rank.get(right.path) ?? Number.MAX_SAFE_INTEGER;
			return leftRank === rightRank ? left.name.localeCompare(right.name, 'zh-CN') : leftRank - rightRank;
		});
		for (const node of nodes) sort(node.children);
	};
	sort(roots);
	return roots;
}

function containsSelectedTag(values: readonly string[], selected: ReadonlySet<string>): boolean {
	if (selected.size === 0) return true;
	return values.some((value) => [...selected].some(
		(item) => value === item || value.startsWith(`${item}/`),
	));
}

function startOfIsoWeek(value: string): string {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year!, month! - 1, day));
	const offset = (date.getUTCDay() + 6) % 7;
	date.setUTCDate(date.getUTCDate() - offset);
	return date.toISOString().slice(0, 10);
}

export function filterPersonalTasks(
	tasks: readonly IndexedTask[],
	filters: PersonalFilters,
	today: string,
): IndexedTask[] {
	const week = startOfIsoWeek(today);
	const month = today.slice(0, 7);
	return tasks.filter((task) => {
		const { startDate, tags } = task.document.metadata;
		if (filters.startPeriod !== 'all') {
			if (!startDate) return false;
			const startDay = datePart(startDate);
			if (filters.startPeriod === 'today' && startDay !== today) return false;
			if (filters.startPeriod === 'week' && startOfIsoWeek(startDay) !== week) return false;
			if (filters.startPeriod === 'month' && !startDay.startsWith(month)) return false;
		}
		return containsSelectedTag(tags, filters.tags);
	});
}

export type TaskQuadrant =
	| 'importantUrgent'
	| 'importantNotUrgent'
	| 'notImportantUrgent'
	| 'notImportantNotUrgent';

export function priorityForQuadrantDrop(
	current: ProjectPriority | undefined,
	quadrant: TaskQuadrant,
	importantPriorities: readonly ProjectPriority[],
): ProjectPriority {
	const targetImportant = quadrant === 'importantUrgent' || quadrant === 'importantNotUrgent';
	const important = new Set(importantPriorities);
	const normalizedCurrent = current ?? 'medium';
	if (important.has(normalizedCurrent) === targetImportant) return normalizedCurrent;
	if (targetImportant) return importantPriorities[0] ?? 'high';
	return ['medium', 'low', 'high'].find((priority) => !important.has(priority)) ?? normalizedCurrent;
}

export type TaskQuadrants = Record<TaskQuadrant, IndexedTask[]>;

function addIsoDays(value: string, days: number): string {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year!, month! - 1, day));
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export function classifyTaskQuadrants(
	tasks: readonly IndexedTask[],
	today: string,
	rules: { importantPriorities: readonly ProjectPriority[]; urgentWithinDays: number } = { importantPriorities: ['high'], urgentWithinDays: 3 },
): TaskQuadrants {
	const urgentThrough = addIsoDays(today, Math.max(0, rules.urgentWithinDays));
	const quadrants: TaskQuadrants = {
		importantUrgent: [],
		importantNotUrgent: [],
		notImportantUrgent: [],
		notImportantNotUrgent: [],
	};
	for (const task of tasks) {
		const important = Boolean(task.document.metadata.priority && rules.importantPriorities.includes(task.document.metadata.priority));
		const dueDate = datePart(task.document.metadata.dueDate);
		const urgent = Boolean(dueDate && dueDate <= urgentThrough);
		const key: TaskQuadrant = important
			? urgent ? 'importantUrgent' : 'importantNotUrgent'
			: urgent ? 'notImportantUrgent' : 'notImportantNotUrgent';
		quadrants[key].push(task);
	}
	for (const tasksInQuadrant of Object.values(quadrants)) {
		tasksInQuadrant.sort((left, right) => {
			const leftDates = [left.document.metadata.dueDate, left.document.metadata.startDate, left.document.metadata.key];
			const rightDates = [right.document.metadata.dueDate, right.document.metadata.startDate, right.document.metadata.key];
			for (let index = 0; index < leftDates.length; index += 1) {
				const leftValue = leftDates[index] ?? '9999-99-99';
				const rightValue = rightDates[index] ?? '9999-99-99';
				const compared = leftValue.localeCompare(rightValue);
				if (compared !== 0) return compared;
			}
			return 0;
		});
	}
	return quadrants;
}

export function taskStatistics(
	tasks: readonly IndexedTask[],
	today: string,
): TaskStatistics {
	let completed = 0;
	let terminated = 0;
	let incomplete = 0;
	let overdue = 0;
	for (const task of tasks) {
		const status = task.project.workflow.statuses.find(
			(item) => item.id === task.document.metadata.statusId,
		);
		if (status?.category === 'done' && status.result === 'completed') completed += 1;
		else if (status?.category === 'done' && status.result === 'terminated') terminated += 1;
		else {
			incomplete += 1;
			const dueDate = datePart(task.document.metadata.dueDate);
			if (dueDate && dueDate < today) overdue += 1;
		}
	}
	const denominator = completed + incomplete;
	return {
		completed,
		terminated,
		incomplete,
		overdue,
		completionRate: denominator === 0 ? 0 : completed / denominator,
	};
}

export interface ProjectFilters {
	projectUid: string;
	keyword?: string;
	statusIds?: ReadonlySet<string>;
	taskTypeIds?: ReadonlySet<string>;
	reporterIds?: ReadonlySet<string>;
	assigneeIds?: ReadonlySet<string>;
	tags?: ReadonlySet<string>;
	statusCategories?: ReadonlySet<string>;
	createdAtFrom?: string;
	createdAtTo?: string;
	scheduledDateFrom?: string;
	scheduledDateTo?: string;
	startDateFrom?: string;
	startDateTo?: string;
	dueDateFrom?: string;
	dueDateTo?: string;
	endDateFrom?: string;
	endDateTo?: string;
	completedAtFrom?: string;
	completedAtTo?: string;
	hasIncompleteSubtasks?: boolean;
	customFields?: Readonly<Record<string, ReadonlySet<unknown>>>;
}

export function activeProjectFilterCount(filters: ProjectFilters): number {
	let count = filters.keyword?.trim() ? 1 : 0;
	for (const selected of [
		filters.statusIds,
		filters.statusCategories,
		filters.taskTypeIds,
		filters.reporterIds,
		filters.assigneeIds,
		filters.tags,
	]) {
		if (selected && selected.size > 0) count += 1;
	}
	for (const [from, to] of [
		[filters.createdAtFrom, filters.createdAtTo],
		[filters.scheduledDateFrom, filters.scheduledDateTo],
		[filters.startDateFrom, filters.startDateTo],
		[filters.dueDateFrom, filters.dueDateTo],
		[filters.endDateFrom, filters.endDateTo],
		[filters.completedAtFrom, filters.completedAtTo],
	]) {
		if (from || to) count += 1;
	}
	for (const selected of Object.values(filters.customFields ?? {})) {
		if (selected.size > 0) count += 1;
	}
	if (filters.hasIncompleteSubtasks) count += 1;
	return count;
}

export function hasIncompleteMarkdownSubtask(value: string | undefined): boolean {
	return /(?:^|\n)\s*[-*+]\s+\[ \]/u.test(value ?? '');
}

function containsAny(values: readonly string[], selected?: ReadonlySet<string>) {
	return !selected || selected.size === 0 || values.some((value) => selected.has(value));
}

function inRange(
	value: string | null,
	from?: string,
	to?: string,
): boolean {
	if (!from && !to) return true;
	if (!value) return false;
	const comparable = value.slice(0, 10);
	return (!from || comparable >= from) && (!to || comparable <= to);
}

export function filterProjectTasks(
	tasks: readonly IndexedTask[],
	filters: ProjectFilters,
): IndexedTask[] {
	const keyword = filters.keyword?.trim().toLocaleLowerCase('zh-CN');
	return tasks.filter((task) => {
		const metadata = task.document.metadata;
		if (filters.projectUid !== ALL_PROJECTS_UID && metadata.projectUid !== filters.projectUid) return false;
		if (
			keyword &&
			![metadata.key, metadata.title, task.document.body]
				.join('\n')
				.toLocaleLowerCase('zh-CN')
				.includes(keyword)
		) return false;
		if (!containsAny([metadata.statusId], filters.statusIds)) return false;
		const status = task.project.workflow.statuses.find((item) => item.id === metadata.statusId);
		if (!containsAny(status ? [status.category] : [], filters.statusCategories)) return false;
		if (!containsAny([metadata.taskTypeId], filters.taskTypeIds)) return false;
		if (!containsAny([metadata.reporterId], filters.reporterIds)) return false;
		if (!containsAny(metadata.assigneeId ? [metadata.assigneeId] : [], filters.assigneeIds)) return false;
		if (!containsAny(metadata.tags, filters.tags)) return false;
		if (!inRange(metadata.createdAt, filters.createdAtFrom, filters.createdAtTo)) return false;
		if (!inRange(metadata.scheduledDate ?? null, filters.scheduledDateFrom, filters.scheduledDateTo)) return false;
		if (!inRange(metadata.startDate, filters.startDateFrom, filters.startDateTo)) return false;
		if (!inRange(metadata.dueDate, filters.dueDateFrom, filters.dueDateTo)) return false;
		if (!inRange(metadata.endDate ?? null, filters.endDateFrom, filters.endDateTo)) return false;
		if (!inRange(metadata.completedAt, filters.completedAtFrom, filters.completedAtTo)) return false;
		if (filters.hasIncompleteSubtasks && !hasIncompleteMarkdownSubtask(task.document.subtasks)) return false;
		for (const [key, selected] of Object.entries(filters.customFields ?? {})) {
			if (selected.size === 0) continue;
			const value = metadata.custom[key];
			const values = Array.isArray(value) ? value : [value];
			if (!values.some((item) => selected.has(item))) return false;
		}
		return true;
	});
}

function isIncomplete(task: IndexedTask): boolean {
	const status = task.project.workflow.statuses.find(
		(item) => item.id === task.document.metadata.statusId,
	);
	return status?.category !== 'done';
}

export function pendingTasks(tasks: readonly IndexedTask[]): IndexedTask[] {
	return tasks.filter(isIncomplete).sort((left, right) => {
		const leftDate = left.document.metadata.dueDate;
		const rightDate = right.document.metadata.dueDate;
		if (leftDate === rightDate) return left.document.metadata.key.localeCompare(right.document.metadata.key);
		if (leftDate === null) return 1;
		if (rightDate === null) return -1;
		return leftDate.localeCompare(rightDate);
	});
}

export function overdueTasks(tasks: readonly IndexedTask[], today: string): IndexedTask[] {
	return tasks
		.filter((task) => isIncomplete(task) && Boolean(datePart(task.document.metadata.dueDate)) && datePart(task.document.metadata.dueDate) < today)
		.sort((left, right) => left.document.metadata.dueDate!.localeCompare(right.document.metadata.dueDate!));
}

export interface CalendarItem {
	uid: string;
	key: string;
	title: string;
	start: string;
	end: string;
}

export function calendarItems(tasks: readonly IndexedTask[], source: CalendarDateSource = 'planned-range'): CalendarItem[] {
	return tasks.flatMap((task) => {
		const metadata = task.document.metadata;
		const scheduled = datePart(metadata.scheduledDate ?? null);
		const due = datePart(metadata.dueDate);
		const start = datePart(metadata.startDate);
		const endDate = datePart(metadata.endDate ?? null);
		const single = source === 'scheduledDate' ? scheduled : source === 'dueDate' ? due : source === 'startDate' ? start : source === 'endDate' ? endDate : null;
		const requestedStart = single ?? (source === 'execution-range' ? start || endDate : scheduled || (due ? due : start || endDate));
		const requestedEnd = single ?? (source === 'execution-range' ? endDate || start : scheduled ? (due || scheduled) : due || endDate || start);
		if (!requestedStart || !requestedEnd) return [];
		return [{
			uid: metadata.uid,
			key: metadata.key,
			title: metadata.title,
			start: requestedStart <= requestedEnd ? requestedStart : requestedEnd,
			end: requestedEnd,
		}];
	});
}
