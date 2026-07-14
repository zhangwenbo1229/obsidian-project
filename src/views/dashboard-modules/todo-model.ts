export interface DashboardTodoItem {
	text: string;
	path: string;
	line: number;
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
		const match = /^\s*[-*+]\s+\[\s\]\s+(.+?)\s*$/u.exec(line);
		return match ? [{ text: match[1]!, path, line: index + 1 }] : [];
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
	if (!/^\s*[-*+]\s+\[[ xX]\]/u.test(line)) throw new Error('待办所在行不再是 Markdown 任务。');
	lines[index] = line.replace(/^(\s*[-*+]\s+)\[[ xX]\]/u, `$1[${completed ? 'x' : ' '}]`);
	return lines.join('');
}
