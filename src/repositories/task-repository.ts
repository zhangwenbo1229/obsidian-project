import type { ProjectConfig, TaskDocument } from '../domain/types';
import {
	parseTaskMarkdown,
	serializeTaskMarkdown,
	type TaskParseResult,
} from '../markdown/task-parser';
import type { VaultAdapter } from './vault-adapter';
import { mapConcurrent } from '../utils/async-pool';
import { composeEmbeddedSubtaskMarkdown, parseEmbeddedSubtasks } from '../markdown/embedded-subtask-parser';

export interface TaskSource {
	path: string;
	source: string;
}

export class TaskRepository {
	constructor(private readonly vault: VaultAdapter) {}

	async create(path: string, document: TaskDocument): Promise<void> {
		const parent = path.split('/').slice(0, -1).join('/');
		if (parent) await this.vault.ensureFolder(parent);
		await this.vault.create(path, serializeTaskMarkdown(document));
	}

	async read(path: string, project: ProjectConfig): Promise<TaskParseResult> {
		return parseTaskMarkdown(await this.vault.read(path), {
			customFieldKeys: new Set(project.customFields.map((field) => field.key)),
		});
	}

	async save(
		path: string,
		document: TaskDocument,
		project: ProjectConfig,
		baseline?: TaskDocument,
	): Promise<void> {
		await this.vault.process(path, (current) => {
			const parsed = parseTaskMarkdown(current, {
				customFieldKeys: new Set(project.customFields.map((field) => field.key)),
			});
			if (parsed.document) {
				document = baseline
					? mergeConcurrentChanges(document, baseline, parsed.document)
					: document;
				document.unknownFrontmatter = {
					...parsed.document.unknownFrontmatter,
					...document.unknownFrontmatter,
				};
			}
			return serializeTaskMarkdown(document);
		});
	}

	async listPaths(directories?: readonly string[]): Promise<string[]> {
		return (await this.listSources(directories)).map((item) => item.path);
	}

	async listSources(directories?: readonly string[]): Promise<TaskSource[]> {
		const paths = directories !== undefined
			? directories.length === 0
				? []
				: [...new Set((await Promise.all([...new Set(directories)].map((directory) => this.vault.listFiles(directory)))).flat())]
					.filter((path) => path.endsWith('.md'))
			: await this.vault.listMarkdownFiles();
		const sources = await mapConcurrent(paths, 8, async (path) => ({ path, source: await this.vault.read(path) }));
		return sources.filter(({ source }) => /^---[\s\S]*?^pm-kind:\s*task\s*$/mu.test(source));
	}

	rename(path: string, nextPath: string): Promise<void> {
		return this.vault.rename(path, nextPath);
	}

	trash(path: string): Promise<void> {
		return this.vault.trash(path);
	}
}

function unchanged(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function mergeConcurrentChanges(
	edited: TaskDocument,
	baseline: TaskDocument,
	current: TaskDocument,
): TaskDocument {
	const merged = structuredClone(edited);
	if (edited.body === baseline.body) merged.body = current.body;
	if ((edited.subtasks ?? '') === (baseline.subtasks ?? '')) merged.subtasks = current.subtasks ?? '';
	else if ((current.subtasks ?? '') !== (baseline.subtasks ?? '')) {
		const editedParts = parseEmbeddedSubtasks(edited.subtasks ?? '');
		const currentParts = parseEmbeddedSubtasks(current.subtasks ?? '');
		const structuredById = new Map(currentParts.subtasks.map((subtask) => [subtask.id, subtask]));
		for (const subtask of editedParts.subtasks) structuredById.set(subtask.id, subtask);
		merged.subtasks = composeEmbeddedSubtaskMarkdown(editedParts.legacyMarkdown, [...structuredById.values()]);
	}
	if (unchanged(edited.relations, baseline.relations)) merged.relations = current.relations;
	if (unchanged(edited.notes, baseline.notes)) merged.notes = current.notes;
	if (unchanged(edited.unknownLinks, baseline.unknownLinks)) merged.unknownLinks = current.unknownLinks;
	const editedMetadata = edited.metadata as unknown as Record<string, unknown>;
	const baselineMetadata = baseline.metadata as unknown as Record<string, unknown>;
	const currentMetadata = current.metadata as unknown as Record<string, unknown>;
	const mergedMetadata = merged.metadata as unknown as Record<string, unknown>;
	for (const key of Object.keys(baselineMetadata)) {
		if (key === 'uid' || key === 'key' || key === 'custom') continue;
		if (unchanged(editedMetadata[key], baselineMetadata[key])) {
			mergedMetadata[key] = currentMetadata[key];
		}
	}
	for (const key of Object.keys(baseline.metadata.custom)) {
		if (unchanged(edited.metadata.custom[key], baseline.metadata.custom[key])) {
			merged.metadata.custom[key] = current.metadata.custom[key];
		}
	}
	return merged;
}
