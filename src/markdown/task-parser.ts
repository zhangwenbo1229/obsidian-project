import { RESERVED_TASK_KEYS } from '../constants';
import type {
	TaskDocument,
	TaskMetadata,
	ProjectPriority,
	TaskNote,
	TaskRelation,
	ValidationIssue,
} from '../domain/types';
import { validateTaskMetadata } from '../domain/validation';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter';

const SECTION_PATTERN = /^##\s+(项目描述|任务正文|链接|任务|子任务|备注)\s*$/gmu;
const RELATION_PATTERN =
	/^-\s*(父项目|父任务|关联)：\[\[([^\]|]+)\|([^\]]+)\]\]\s*<!--\s*op-relation-id:\s*([^;]+);\s*target-uid:\s*([^\s]+)\s*-->\s*$/u;
const NOTE_PATTERN =
	/^###\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+·\s+(.+)\n\s*<!--\s*op-note-id:\s*([^;]+);\s*author-id:\s*([^\s]+)\s*-->\s*\n([\s\S]*?)(?=^###\s+|(?![\s\S]))/gmu;

export interface TaskParseOptions {
	customFieldKeys?: ReadonlySet<string>;
}

export interface TaskParseResult {
	document: TaskDocument | null;
	issues: ValidationIssue[];
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function hasKey(value: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, key);
}

function metadataFromFrontmatter(
	frontmatter: Record<string, unknown>,
	customFieldKeys: ReadonlySet<string>,
): {
	metadata: TaskMetadata;
	unknownFrontmatter: Record<string, unknown>;
} {
	const legacyDateModel = !hasKey(frontmatter, 'scheduled-date') && !hasKey(frontmatter, 'end-date');
	const custom: Record<string, unknown> = {};
	const unknownFrontmatter: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		if (RESERVED_TASK_KEYS.has(key)) continue;
		if (customFieldKeys.has(key)) custom[key] = value;
		else unknownFrontmatter[key] = value;
	}

	return {
		metadata: {
			kind: frontmatter['pm-kind'] as 'task',
			schema: frontmatter['pm-schema'] as 1,
			uid: text(frontmatter.uid),
			key: text(frontmatter.key),
			projectUid: text(frontmatter['project-uid']),
			title: text(frontmatter.title),
			taskTypeId: text(frontmatter['task-type-id']),
			priority: (
				frontmatter['task-priority'] ??
				(['high', 'medium', 'low'].includes(String(frontmatter.priority)) ? frontmatter.priority : 'medium')
			) as ProjectPriority,
			createdAt: text(frontmatter['created-at']),
			scheduledDate: (legacyDateModel ? frontmatter['due-date'] : frontmatter['scheduled-date'] ?? null) as string | null,
			startDate: (frontmatter['start-date'] ?? null) as string | null,
			dueDate: (legacyDateModel ? null : frontmatter['due-date'] ?? null) as string | null,
			endDate: (frontmatter['end-date'] ?? null) as string | null,
			completedAt: (frontmatter['completed-at'] ?? null) as string | null,
			terminatedAt: (frontmatter['terminated-at'] ?? null) as string | null,
			reporterId: text(frontmatter['reporter-id']),
			assigneeId: (frontmatter['assignee-id'] ?? null) as string | null,
			statusId: text(frontmatter['status-id']),
			tags: Array.isArray(frontmatter.tags)
				? frontmatter.tags.filter(
						(value): value is string => typeof value === 'string',
					)
				: [],
			custom,
		},
		unknownFrontmatter,
	};
}

function splitSections(body: string) {
	const matches = [...body.matchAll(SECTION_PATTERN)];
	const sections = new Map<string, string>();
	for (const [index, match] of matches.entries()) {
		const sourceName = match[1]!;
		const name = sourceName === '任务正文' ? '项目描述' : sourceName === '子任务' ? '任务' : sourceName;
		const start = (match.index ?? 0) + match[0].length;
		const end = matches[index + 1]?.index ?? body.length;
		sections.set(name, body.slice(start, end).trim());
	}
	return sections;
}

function parseRelations(content: string): {
	relations: TaskRelation[];
	unknownLinks: string[];
} {
	const relations: TaskRelation[] = [];
	const unknownLinks: string[] = [];
	for (const line of content.split('\n').map((value) => value.trim()).filter(Boolean)) {
		const match = RELATION_PATTERN.exec(line);
		if (!match) {
			unknownLinks.push(line);
			continue;
		}
		relations.push({
			id: match[4]!.trim(),
			type: match[1] === '父任务' || match[1] === '父项目' ? 'parent' : 'related',
			targetUid: match[5]!.trim(),
			targetKey: match[2]!.trim(),
			targetTitle: match[3]!.trim(),
		});
	}
	return { relations, unknownLinks };
}

function parseNotes(content: string): TaskNote[] {
	const notes: TaskNote[] = [];
	for (const match of content.matchAll(NOTE_PATTERN)) {
		notes.push({
			createdAt: match[1]!,
			authorName: match[2]!.trim(),
			id: match[3]!.trim(),
			authorId: match[4]!.trim(),
			content: match[5]!.trim(),
		});
	}
	return notes;
}

export function parseTaskMarkdown(
	source: string,
	options: TaskParseOptions = {},
): TaskParseResult {
	try {
		const parsed = parseFrontmatter(source);
		const mapped = metadataFromFrontmatter(
			parsed.frontmatter,
			options.customFieldKeys ?? new Set(),
		);
		const issues = [...validateTaskMetadata(mapped.metadata).issues];
		const sections = splitSections(parsed.body);
		for (const section of ['项目描述', '链接', '备注']) {
			if (!sections.has(section)) {
				issues.push({
					code: 'missing-section',
					path: section,
					message: `缺少 ## ${section}。`,
				});
			}
		}
		const relationData = parseRelations(sections.get('链接') ?? '');
		return {
				document: {
				metadata: mapped.metadata,
					body: sections.get('项目描述') ?? parsed.body.trim(),
					subtasks: sections.get('任务') ?? '',
				relations: relationData.relations,
				notes: parseNotes(sections.get('备注') ?? ''),
				unknownFrontmatter: mapped.unknownFrontmatter,
				unknownLinks: relationData.unknownLinks,
				lineEnding: parsed.lineEnding,
			},
			issues,
		};
	} catch (error) {
		return {
			document: null,
			issues: [
				{
					code: 'invalid-frontmatter',
					path: '',
					message: error instanceof Error ? error.message : String(error),
				},
			],
		};
	}
}

function taskFrontmatter(document: TaskDocument): Record<string, unknown> {
	const task = document.metadata;
	return {
		'pm-kind': task.kind,
		'pm-schema': task.schema,
		uid: task.uid,
		key: task.key,
		'project-uid': task.projectUid,
		title: task.title,
		'task-type-id': task.taskTypeId,
		'task-priority': task.priority ?? 'medium',
		'created-at': task.createdAt,
		'scheduled-date': task.scheduledDate ?? null,
		'start-date': task.startDate,
		'due-date': task.dueDate,
		'end-date': task.endDate ?? null,
		'completed-at': task.completedAt,
		'terminated-at': task.terminatedAt,
		'reporter-id': task.reporterId,
		'assignee-id': task.assigneeId,
		'status-id': task.statusId,
		tags: task.tags,
		...task.custom,
		...document.unknownFrontmatter,
	};
}

function serializeRelations(document: TaskDocument): string {
	const structured = document.relations.map((relation) => {
		const label = relation.type === 'parent' ? '父项目' : '关联';
		return `- ${label}：[[${relation.targetKey}|${relation.targetTitle}]] <!-- op-relation-id: ${relation.id}; target-uid: ${relation.targetUid} -->`;
	});
	return [...structured, ...document.unknownLinks].join('\n');
}

function noteHeading(value: string): string {
	return value.includes('T') ? value.replace('T', ' ').slice(0, 16) : value;
}

function serializeNotes(notes: TaskNote[]): string {
	return notes
		.map(
			(note) =>
				`### ${noteHeading(note.createdAt)} · ${note.authorName}\n\n<!-- op-note-id: ${note.id}; author-id: ${note.authorId} -->\n\n${note.content.trim()}`,
		)
		.join('\n\n');
}

export function serializeTaskMarkdown(document: TaskDocument): string {
	const body = [
		'## 项目描述',
		'',
		document.body.trim(),
		'',
		'## 链接',
		'',
		serializeRelations(document),
		'',
		'## 任务',
		'',
		(document.subtasks ?? '').trim(),
		'',
		'## 备注',
		'',
		serializeNotes(document.notes),
	]
		.join('\n')
		.trimEnd();
	return serializeFrontmatter(taskFrontmatter(document), body, document.lineEnding);
}
