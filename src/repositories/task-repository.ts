import type { ProjectConfig, TaskDocument } from '../domain/types';
import {
	parseTaskMarkdown,
	serializeTaskMarkdown,
	type TaskParseResult,
} from '../markdown/task-parser';
import type { VaultAdapter } from './vault-adapter';

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

	async listPaths(): Promise<string[]> {
		const paths = await this.vault.listMarkdownFiles();
		const results: string[] = [];
		for (const path of paths) {
			const source = await this.vault.read(path);
			if (/^---[\s\S]*?^pm-kind:\s*task\s*$/mu.test(source)) results.push(path);
		}
		return results;
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
