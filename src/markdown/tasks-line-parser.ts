export type TasksLinePriority = 'high' | 'medium' | 'low' | 'normal';
import { decodeTaskCustomMetadataTag, encodeTaskCustomMetadataTag } from './task-custom-metadata-codec';

export interface TasksLine {
	marker: '-' | '*' | '+';
	status: string;
	completed: boolean;
	title: string;
	priority: TasksLinePriority;
	tags: string[];
	scheduledDate: string | null;
	startDate: string | null;
	dueDate: string | null;
	createdDate: string | null;
	doneDate: string | null;
	cancelledDate: string | null;
	id: string | null;
	custom?: Record<string, unknown>;
}

const TASK_LINE = /^(\s*)([-*+])\s+\[([^\]])\]\s+(.+?)\s*$/u;
const DATE_TOKEN = /^(⏳|🛫|📅|➕|✅|❌)\s+(\d{4}-\d{2}-\d{2})(?:\s+|$)/u;
const ID_TOKEN = /^🆔\s+([A-Za-z0-9_-]+)(?:\s+|$)/u;
const TAG_TOKEN = /^(#[\p{L}\p{N}_/-]+)(?:\s+|$)/u;
const PRIORITY_TOKEN = /^(⏫|🔼|🔽)(?:\s+|$)/u;
const CUSTOM_TOKEN = /^(#op-meta\/(?:v1\/)?[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)(?:\s+|$)/u;

interface TasksLineParts {
	indent: string;
	marker: TasksLine['marker'];
	status: string;
	title: string;
	metadataSource: string;
	trailing: string;
}

function priorityFromEmoji(value: string): TasksLinePriority {
	if (value === '⏫') return 'high';
	if (value === '🔼') return 'medium';
	if (value === '🔽') return 'low';
	return 'normal';
}

function priorityEmoji(value: TasksLinePriority): string {
	if (value === 'high') return '⏫';
	if (value === 'medium') return '🔼';
	if (value === 'low') return '🔽';
	return '';
}

function decodeCustomToken(match: RegExpMatchArray): [string, unknown] | null {
	return decodeTaskCustomMetadataTag(match[1]!);
}

function parseMetadata(source: string): Omit<TasksLine, 'marker' | 'status' | 'completed' | 'title'> | null {
	let remaining = source.trim();
	const result = {
		priority: 'normal' as TasksLinePriority,
		tags: [] as string[], scheduledDate: null as string | null, startDate: null as string | null,
		dueDate: null as string | null, createdDate: null as string | null, doneDate: null as string | null,
		cancelledDate: null as string | null, id: null as string | null,
		custom: {} as Record<string, unknown>,
	};
	while (remaining) {
		const custom = remaining.match(CUSTOM_TOKEN);
		if (custom) {
			const decoded = decodeCustomToken(custom);
			if (decoded) {
				result.custom[decoded[0]] = decoded[1];
				remaining = remaining.slice(custom[0].length);
				continue;
			}
		}
		const date = remaining.match(DATE_TOKEN);
		if (date) {
			const symbol = date[1] as '⏳' | '🛫' | '📅' | '➕' | '✅' | '❌';
			const key = ({ '⏳': 'scheduledDate', '🛫': 'startDate', '📅': 'dueDate', '➕': 'createdDate', '✅': 'doneDate', '❌': 'cancelledDate' } as const)[symbol];
			result[key] = date[2]!;
			remaining = remaining.slice(date[0].length);
			continue;
		}
		const id = remaining.match(ID_TOKEN);
		if (id) { result.id = id[1]!; remaining = remaining.slice(id[0].length); continue; }
		const tag = remaining.match(TAG_TOKEN);
		if (tag) { result.tags.push(tag[1]!.slice(1)); remaining = remaining.slice(tag[0].length); continue; }
		const priority = remaining.match(PRIORITY_TOKEN);
		if (priority) { result.priority = priorityFromEmoji(priority[1]!); remaining = remaining.slice(priority[0].length); continue; }
		return null;
	}
	return result;
}

function splitTasksLine(line: string): TasksLineParts | null {
	const match = line.match(TASK_LINE);
	if (!match) return null;
	const content = match[4]!;
	let split = content.length;
	for (let index = 0; index < content.length; index += 1) {
		if (index > 0 && !/\s/u.test(content[index - 1]!)) continue;
		const candidate = parseMetadata(content.slice(index));
		if (!candidate) continue;
		split = index;
		break;
	}
	return {
		indent: match[1]!, marker: match[2]! as TasksLine['marker'], status: match[3]!,
		title: content.slice(0, split).trim(), metadataSource: content.slice(split).trim(),
		trailing: line.match(/\s*$/u)?.[0] ?? '',
	};
}

export function parseTasksLine(line: string): TasksLine | null {
	const parts = splitTasksLine(line);
	if (!parts) return null;
	const metadata = parseMetadata(parts.metadataSource)!;
	const status = parts.status;
	return {
		marker: parts.marker, status, completed: status.toLowerCase() === 'x', title: parts.title, ...metadata,
	};
}

export function serializeTasksLine(task: TasksLine): string {
	const parts = [task.title.trim(), ...task.tags.map((tag) => `#${tag.replace(/^#+/u, '')}`)];
	for (const [key, value] of Object.entries(task.custom ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
		if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
		parts.push(encodeTaskCustomMetadataTag(key, value));
	}
	const priority = priorityEmoji(task.priority);
	if (priority) parts.push(priority);
	for (const [emoji, value] of [
		['⏳', task.scheduledDate], ['🛫', task.startDate], ['📅', task.dueDate], ['➕', task.createdDate],
		['✅', task.doneDate], ['❌', task.cancelledDate], ['🆔', task.id],
	] as const) if (value) parts.push(`${emoji} ${value}`);
	return `${task.marker} [${task.status}] ${parts.join(' ')}`;
}

export function updateTasksLineTitle(line: string, title: string): string {
	const parts = splitTasksLine(line);
	const next = title.trim().replace(/[\r\n]+/gu, ' ');
	if (!parts || !next) throw new Error('任务内容无效。');
	return `${parts.indent}${parts.marker} [${parts.status}] ${next}${parts.metadataSource ? ` ${parts.metadataSource}` : ''}${parts.trailing}`;
}

export function updateTasksLineCompletion(line: string, completed: boolean, date: string): string {
	const parsed = parseTasksLine(line);
	if (!parsed) throw new Error('任务内容无效。');
	return serializeTasksLine({
		...parsed, status: completed ? 'x' : ' ', completed,
		doneDate: completed ? date : null,
	});
}
