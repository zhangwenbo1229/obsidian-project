import { parse, stringify } from 'yaml';

export interface ParsedFrontmatter {
	frontmatter: Record<string, unknown>;
	body: string;
	lineEnding: '\n' | '\r\n';
}

export function parseFrontmatter(source: string): ParsedFrontmatter {
	const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
	const normalized = source.replaceAll('\r\n', '\n');
	const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(normalized);
	if (!match) throw new Error('Markdown 文件缺少有效的 YAML frontmatter。');
	const parsed: unknown = parse(match[1] ?? '');
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error('YAML frontmatter 必须是对象。');
	}
	return {
		frontmatter: parsed as Record<string, unknown>,
		body: normalized.slice(match[0].length),
		lineEnding,
	};
}

export function serializeFrontmatter(
	frontmatter: Record<string, unknown>,
	body: string,
	lineEnding: '\n' | '\r\n' = '\n',
): string {
	const yaml = stringify(frontmatter, { lineWidth: 0 }).trimEnd();
	return `---\n${yaml}\n---\n\n${body.trimEnd()}\n`.replaceAll(
		'\n',
		lineEnding,
	);
}
