import type { IndexedTask } from '../index/task-index';
import {
	parseTasksLine,
	updateTasksLineCompletion,
	updateTasksLineTitle,
	type TasksLinePriority,
} from '../markdown/tasks-line-parser';

export type TaskViewScope = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

export interface TaskViewItem {
	id: string;
	kind: 'structured' | 'markdown';
	title: string;
	completed: boolean;
	priority: TasksLinePriority;
	tags: string[];
	scheduledDate: string | null;
	startDate: string | null;
	dueDate: string | null;
	createdDate: string | null;
	doneDate: string | null;
	cancelledDate: string | null;
	taskId: string | null;
	parentUid: string;
	parentKey: string;
	parentTitle: string;
	parentPath: string;
	projectUid: string;
	projectCode: string;
	projectName: string;
	lineNumber: number;
	originalLine: string;
	custom: Record<string, unknown>;
	parent: IndexedTask;
}

export interface TaskViewFilter {
	scope: TaskViewScope;
	today: string;
	keyword?: string;
	projectUid?: string | null;
	showCompleted?: boolean;
}

export interface TaskViewGroup {
	parentUid: string;
	parentKey: string;
	parentTitle: string;
	parentPath: string;
	projectCode: string;
	projectName: string;
	items: TaskViewItem[];
}

function dateOnly(value: string | null): string | null {
	return value?.match(/^\d{4}-\d{2}-\d{2}/u)?.[0] ?? null;
}

export function taskViewItemDate(item: TaskViewItem): string | null {
	return dateOnly(item.dueDate) ?? dateOnly(item.scheduledDate) ?? dateOnly(item.startDate);
}

export function collectTaskViewItems(parents: readonly IndexedTask[]): TaskViewItem[] {
	const items: TaskViewItem[] = [];
	for (const parent of parents) {
		const markdown = parent.document.subtasks ?? '';
		for (const [lineNumber, originalLine] of markdown.replace(/\r\n?/gu, '\n').split('\n').entries()) {
			const parsed = parseTasksLine(originalLine);
			if (!parsed) continue;
			const taskId = parsed.id;
			items.push({
				id: `${parent.document.metadata.uid}:${taskId ?? `line:${lineNumber}`}`,
				kind: taskId ? 'structured' : 'markdown',
				title: parsed.title,
				completed: parsed.completed,
				priority: parsed.priority,
				tags: parsed.tags,
				scheduledDate: parsed.scheduledDate,
				startDate: parsed.startDate,
				dueDate: parsed.dueDate,
				createdDate: parsed.createdDate,
				doneDate: parsed.doneDate,
				cancelledDate: parsed.cancelledDate,
				taskId,
				parentUid: parent.document.metadata.uid,
				parentKey: parent.document.metadata.key,
				parentTitle: parent.document.metadata.title,
				parentPath: parent.path,
				projectUid: parent.project.uid,
				projectCode: parent.project.code,
				projectName: parent.project.name,
				lineNumber,
				originalLine,
				custom: parsed.custom ?? {},
				parent,
			});
		}
	}
	return items;
}

function matchesScope(item: TaskViewItem, scope: TaskViewScope, today: string, showCompleted: boolean): boolean {
	if (scope === 'completed') return item.completed;
	if (item.completed) return showCompleted;
	if (scope === 'all') return true;
	const date = taskViewItemDate(item);
	if (!date) return false;
	if (scope === 'today') return date === today;
	if (scope === 'upcoming') return date > today;
	return date < today;
}

export function filterTaskViewItems(items: readonly TaskViewItem[], filter: TaskViewFilter): TaskViewItem[] {
	const keyword = filter.keyword?.trim().toLocaleLowerCase() ?? '';
	return items.filter((item) => {
		if (filter.projectUid && item.projectUid !== filter.projectUid) return false;
		if (!matchesScope(item, filter.scope, filter.today, filter.showCompleted ?? false)) return false;
		if (!keyword) return true;
		return [item.title, item.parentKey, item.parentTitle, item.projectCode, item.projectName, ...item.tags]
			.some((value) => value.toLocaleLowerCase().includes(keyword));
	}).sort((left, right) => {
		const leftDate = taskViewItemDate(left) ?? '9999-12-31';
		const rightDate = taskViewItemDate(right) ?? '9999-12-31';
		return leftDate.localeCompare(rightDate)
			|| left.parentKey.localeCompare(right.parentKey)
			|| left.lineNumber - right.lineNumber;
	});
}

export function groupTaskViewItems(items: readonly TaskViewItem[]): TaskViewGroup[] {
	const groups = new Map<string, TaskViewGroup>();
	for (const item of items) {
		let group = groups.get(item.parentUid);
		if (!group) {
			group = {
				parentUid: item.parentUid,
				parentKey: item.parentKey,
				parentTitle: item.parentTitle,
				parentPath: item.parentPath,
				projectCode: item.projectCode,
				projectName: item.projectName,
				items: [],
			};
			groups.set(item.parentUid, group);
		}
		group.items.push(item);
	}
	return [...groups.values()];
}

function replaceTaskViewSourceLine(
	markdown: string,
	item: TaskViewItem,
	replace: (line: string) => string,
): string {
	const lineEnding = markdown.includes('\r\n') ? '\r\n' : markdown.includes('\r') ? '\r' : '\n';
	const lines = markdown.split(/\r\n|\n|\r/u);
	const current = lines[item.lineNumber];
	if (current === undefined) throw new Error('任务所在行不存在，项目可能已被修改。');
	if (current !== item.originalLine) throw new Error('任务内容已被修改，请刷新后重试。');
	lines[item.lineNumber] = replace(current);
	return lines.join(lineEnding);
}

export function updateTaskViewItemCompletion(
	markdown: string,
	item: TaskViewItem,
	completed: boolean,
	today: string,
): string {
	return replaceTaskViewSourceLine(markdown, item, (line) => {
		if (item.kind === 'structured') {
			const indent = line.match(/^\s*/u)?.[0] ?? '';
			return `${indent}${updateTasksLineCompletion(line, completed, today)}`;
		}
		return line.replace(/^(\s*[-*+]\s+)\[[ xX]\]/u, `$1[${completed ? 'x' : ' '}]`);
	});
}

export function updateTaskViewItemTitle(markdown: string, item: TaskViewItem, title: string): string {
	return replaceTaskViewSourceLine(markdown, item, (line) => updateTasksLineTitle(line, title));
}
