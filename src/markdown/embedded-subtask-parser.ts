import type { EmbeddedSubtask, TaskPriority } from '../domain/types';
import { parseTasksLine, serializeTasksLine } from './tasks-line-parser';
import { isUuidV4 } from '../domain/validation';

const LEGACY_LINE = /^- \[([ xX])\] (.*?) <!-- op-subtask: (\{.*\}) -->$/u;

export interface EmbeddedSubtaskParseResult {
	subtasks: EmbeddedSubtask[];
	legacyMarkdown: string;
	issues: string[];
}

function day(value: unknown): string | null {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/u.test(value) ? value.slice(0, 10) : null;
}

function priority(value: string): TaskPriority {
	return value === 'high' || value === 'low' ? value : 'medium';
}

function legacySubtask(line: string): EmbeddedSubtask | null {
	const match = line.match(LEGACY_LINE);
	if (!match) return null;
	try {
		const metadata = JSON.parse(match[3]!) as Record<string, unknown>;
		if (!isUuidV4(metadata.id)) return null;
		if (metadata.priority !== 'high' && metadata.priority !== 'medium' && metadata.priority !== 'low') return null;
		if (!Array.isArray(metadata.tags) || metadata.tags.some((tag) => typeof tag !== 'string')) return null;
		if (!day(metadata.createdAt) || !day(metadata.updatedAt)) return null;
		return {
			id: metadata.id.replace(/-/gu, '').slice(0, 8), title: match[2]!.trim(), completed: match[1]!.toLowerCase() === 'x',
			priority: priority(String(metadata.priority)), scheduledDate: null, startDate: day(metadata.startDate), dueDate: day(metadata.dueDate),
			tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === 'string') : [],
			createdDate: day(metadata.createdAt), doneDate: null, cancelledDate: null,
		};
	} catch { return null; }
}

function fromTasksLine(line: string): EmbeddedSubtask | null {
	const task = parseTasksLine(line);
	if (!task?.id) return null;
	const custom = task.custom ?? {};
	return {
		id: task.id, title: task.title, completed: task.completed, priority: priority(task.priority),
		scheduledDate: task.scheduledDate, startDate: task.startDate, dueDate: task.dueDate, tags: task.tags,
		createdDate: task.createdDate, doneDate: task.doneDate, cancelledDate: task.cancelledDate,
		...(Object.keys(custom).length > 0 ? { custom } : {}),
	};
}

export function parseEmbeddedSubtasks(markdown: string): EmbeddedSubtaskParseResult {
	const subtasks: EmbeddedSubtask[] = [];
	const legacy: string[] = [];
	const issues: string[] = [];
	const seen = new Set<string>();
	for (const line of markdown ? markdown.replace(/\r\n?/gu, '\n').split('\n') : []) {
		const structured = fromTasksLine(line) ?? legacySubtask(line);
		if (!structured) {
			legacy.push(line);
			if (line.includes('op-subtask:')) issues.push(`任务元数据无效：${line.slice(0, 60)}`);
			continue;
		}
		if (seen.has(structured.id)) { issues.push(`子任务 ID 重复：${structured.id}`); continue; }
		seen.add(structured.id); subtasks.push(structured);
	}
	return { subtasks, legacyMarkdown: legacy.join('\n').trim(), issues };
}

export function serializeEmbeddedSubtask(subtask: EmbeddedSubtask): string {
	return serializeTasksLine({
		marker: '-', status: subtask.completed ? 'x' : ' ', completed: subtask.completed, title: subtask.title,
		priority: subtask.priority, tags: subtask.tags, scheduledDate: day(subtask.scheduledDate), startDate: day(subtask.startDate),
		dueDate: day(subtask.dueDate), createdDate: subtask.createdDate, doneDate: subtask.doneDate,
		cancelledDate: subtask.cancelledDate, id: subtask.id,
		custom: subtask.custom ?? {},
	});
}

export function upsertEmbeddedSubtask(markdown: string, subtask: EmbeddedSubtask): string {
	const parsed = parseEmbeddedSubtasks(markdown);
	const next = parsed.subtasks.filter((item) => item.id !== subtask.id);
	next.push(subtask);
	return composeEmbeddedSubtaskMarkdown(parsed.legacyMarkdown, next);
}

export function removeEmbeddedSubtask(markdown: string, id: string): string {
	const parsed = parseEmbeddedSubtasks(markdown);
	return composeEmbeddedSubtaskMarkdown(parsed.legacyMarkdown, parsed.subtasks.filter((item) => item.id !== id));
}

export function composeEmbeddedSubtaskMarkdown(legacyMarkdown: string, subtasks: readonly EmbeddedSubtask[]): string {
	return [legacyMarkdown.trim(), ...subtasks.map(serializeEmbeddedSubtask)].filter(Boolean).join('\n').trim();
}
