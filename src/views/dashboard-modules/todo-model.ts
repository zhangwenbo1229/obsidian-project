import { parseTasksLine, updateTasksLineCompletion, updateTasksLineTitle, type TasksLine } from '../../markdown/tasks-line-parser';

export interface DashboardTodoItem {
	text: string;
	path: string;
	line: number;
	metadata?: Pick<TasksLine, 'priority' | 'tags' | 'scheduledDate' | 'startDate' | 'dueDate' | 'createdDate' | 'doneDate' | 'id' | 'custom'>;
}

function normalizePath(path: string): string {
	return path.trim().replace(/^\/+|\/+$/gu, '');
}

function belongsTo(path: string, root: string): boolean {
	const normalized = normalizePath(root);
	return !normalized || path === normalized || path.startsWith(`${normalized}/`);
}

export function isTodoPathInScope(path: string, rootPaths: readonly string[], excludePaths: readonly string[]): boolean {
	const roots = rootPaths.map(normalizePath).filter(Boolean);
	const exclusions = excludePaths.map(normalizePath).filter(Boolean);
	return (roots.length === 0 || roots.some((root) => belongsTo(path, root)))
		&& !exclusions.some((root) => belongsTo(path, root));
}

export function extractIncompleteTodos(markdown: string, path: string): DashboardTodoItem[] {
	return markdown.split(/\r?\n/u).flatMap((line, index) => {
		const task = parseTasksLine(line);
		if (!task || task.completed || task.status !== ' ') return [];
		const { priority, tags, scheduledDate, startDate, dueDate, createdDate, doneDate, id, custom } = task;
		const hasMetadata = priority !== 'normal' || tags.length > 0 || Boolean(scheduledDate || startDate || dueDate || createdDate || doneDate || id) || Object.keys(custom ?? {}).length > 0;
		return [{
			text: task.title, path, line: index + 1,
			...(hasMetadata ? { metadata: { priority, tags, scheduledDate, startDate, dueDate, createdDate, doneDate, id, custom } } : {}),
		}];
	});
}

export function collectIncompleteTodos(
	files: readonly { path: string; content: string }[],
	rootPaths: readonly string[],
	excludePaths: readonly string[],
	limit: number,
): DashboardTodoItem[] {
	return files
		.filter((file) => isTodoPathInScope(file.path, rootPaths, excludePaths))
		.flatMap((file) => extractIncompleteTodos(file.content, file.path))
		.slice(0, Math.max(0, limit));
}

export function setMarkdownTodoCompleted(markdown: string, lineNumber: number, completed: boolean): string {
	const lines = markdown.match(/.*(?:\r\n|\n|\r|$)/gu)?.filter((line) => line.length > 0) ?? [];
	const index = lineNumber - 1;
	if (index < 0 || index >= lines.length) throw new Error('待办所在行不存在，笔记可能已被修改。');
	const line = lines[index]!;
	const ending = line.match(/(\r\n|\n|\r)$/u)?.[0] ?? '';
	const source = line.replace(/\r?\n|\r$/u, '');
	const parsed = parseTasksLine(source);
	if (!parsed) throw new Error('待办所在行不再是 Markdown 任务。');
	try {
		lines[index] = parsed.priority !== 'normal' || parsed.tags.length > 0 || parsed.scheduledDate || parsed.startDate || parsed.dueDate || parsed.createdDate || parsed.doneDate || parsed.id || Object.keys(parsed.custom ?? {}).length > 0
			? `${updateTasksLineCompletion(source, completed, new Date().toISOString().slice(0, 10))}${ending}`
			: `${source.replace(/^(\s*[-*+]\s+)\[[ xX]\]/u, `$1[${completed ? 'x' : ' '}]`)}${ending}`;
	}
	catch { throw new Error('待办所在行不再是 Markdown 任务。'); }
	return lines.join('');
}

export function setMarkdownTodoText(markdown: string, lineNumber: number, expectedText: string, nextText: string): string {
	const replacement = nextText.trim();
	if (!replacement) throw new Error('待办内容不能为空。');
	const lines = markdown.match(/.*(?:\r\n|\n|\r|$)/gu)?.filter((line) => line.length > 0) ?? [];
	const index = lineNumber - 1;
	if (index < 0 || index >= lines.length) throw new Error('待办所在行不存在，笔记可能已被修改。');
	const line = lines[index]!;
	const ending = line.match(/(\r\n|\n|\r)$/u)?.[0] ?? '';
	const source = line.replace(/\r?\n|\r$/u, '');
	const parsed = parseTasksLine(source);
	if (!parsed) throw new Error('待办所在行不再是 Markdown 任务。');
	if (parsed.title !== expectedText) throw new Error('待办内容已被修改，请刷新后重试。');
	lines[index] = `${updateTasksLineTitle(source, replacement)}${ending}`;
	return lines.join('');
}
