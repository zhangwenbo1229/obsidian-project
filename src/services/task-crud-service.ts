import type { TaskDocument, EmbeddedSubtask } from '../domain/types';
import { validateTaskMetadata, validateTaskReferences } from '../domain/validation';
import { parseTaskMarkdown } from '../markdown/task-parser';
import { createUuid } from '../utils/ids';
import { prepareNewTask, type NewTaskInput } from './task-service';
import { planTaskDeletion } from './deletion-service';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from './project-manager';
import { createEmbeddedSubtask as prepareEmbeddedSubtask, type EmbeddedSubtaskInput, updateEmbeddedSubtask as patchEmbeddedSubtask } from './embedded-subtask-service';
import { parseEmbeddedSubtasks, removeEmbeddedSubtask, upsertEmbeddedSubtask } from '../markdown/embedded-subtask-parser';

export class TaskCrudService {
	constructor(private readonly manager: ProjectManager) {}

	async create(input: Omit<NewTaskInput, 'globalConfig'>): Promise<string> {
		const existingKeys = new Set(
			this.manager.index.validTasks().map((task) => task.document.metadata.key),
		);
		const prepared = prepareNewTask(
			{ ...input, globalConfig: this.manager.globalConfig },
			existingKeys,
		);
		input.project.nextNumber = prepared.nextNumber;
		this.manager.replaceProject(input.project);
		await this.manager.persistConfiguration();
		await this.manager.taskRepository.create(prepared.path, prepared.document);
		await this.manager.reload();
		return prepared.path;
	}

	async save(entry: IndexedTask, document: TaskDocument): Promise<void> {
		const validation = validateTaskMetadata(document.metadata);
		const referenceIssues = validateTaskReferences(
			document.metadata,
			entry.project,
			new Set(this.manager.globalConfig.people.map((p) => p.id)),
		);
		const issues = [...validation.issues, ...referenceIssues];
		if (issues.length > 0) throw new Error(issues.map((i) => i.message).join('\n'));
		await this.manager.taskRepository.save(entry.path, document, entry.project, entry.document);
		await this.manager.reload();
	}

	async delete(entry: IndexedTask): Promise<void> {
		const plan = planTaskDeletion(entry, this.manager.index);
		if (plan.issues.length > 0) throw new Error(plan.issues[0]!.message);
		for (const edit of plan.relatedEdits) {
			await this.manager.taskRepository.save(edit.path, edit.document, edit.project);
		}
		await this.manager.taskRepository.trash(entry.path);
		await this.manager.reload();
	}

	async repairIssue(path: string, code: string): Promise<void> {
		const entry = this.manager.index.validTasks().find((task) => task.path === path);
		const projects = this.manager.projects;

		if (entry && code === 'filename-key-mismatch') {
			const directory = path.split('/').slice(0, -1).join('/');
			await this.manager.taskRepository.rename(path, `${directory}/${entry.document.metadata.key}.md`);
		} else if (entry && code === 'relation-target-missing') {
			const document = structuredClone(entry.document);
			document.relations = document.relations.filter((r) => this.manager.index.get(r.targetUid));
			await this.manager.taskRepository.save(path, document, entry.project);
		} else if (code === 'duplicate-key' || code === 'duplicate-uuid' || code === 'missing-section') {
			const source = await this.manager.vault.read(path);
			const parsed = parseTaskMarkdown(source, {
				customFieldKeys: new Set(projects.flatMap((p) => p.customFields.map((f) => f.key))),
			});
			if (!parsed.document) throw new Error('任务文件无法解析。');
			const project = projects.find((p) => p.uid === parsed.document?.metadata.projectUid);
			if (!project) throw new Error('找不到任务所属项目。');
			let resolvedPath = path;
			if (code === 'duplicate-uuid') {
				parsed.document.metadata.uid = createUuid();
				this.manager.authorizedIdentities.set(resolvedPath, {
					uid: parsed.document.metadata.uid,
					key: parsed.document.metadata.key,
				});
			}
			if (code === 'duplicate-key') {
				const keys = new Set<string>();
				for (const taskPath of await this.manager.taskRepository.listPaths()) {
					const task = parseTaskMarkdown(await this.manager.vault.read(taskPath)).document;
					if (task) keys.add(task.metadata.key);
				}
				let number = project.nextNumber;
				while (keys.has(`${project.code}-${number}`)) number += 1;
				parsed.document.metadata.key = `${project.code}-${number}`;
				project.nextNumber = number + 1;
				this.manager.replaceProject(project);
				await this.manager.persistConfiguration();
				const directory = resolvedPath.split('/').slice(0, -1).join('/');
				const nextPath = `${directory}/${parsed.document.metadata.key}.md`;
				this.manager.authorizedIdentities.set(nextPath, {
					uid: parsed.document.metadata.uid,
					key: parsed.document.metadata.key,
				});
				await this.manager.taskRepository.rename(resolvedPath, nextPath);
				resolvedPath = nextPath;
			}
			await this.manager.taskRepository.save(resolvedPath, parsed.document, project);
		} else {
			throw new Error('该问题需要在 Markdown 中手动修复。');
		}
		await this.manager.reload();
	}

	embeddedSubtasks(entry: IndexedTask): EmbeddedSubtask[] {
		return parseEmbeddedSubtasks(entry.document.subtasks ?? '').subtasks;
	}

	async createEmbeddedSubtask(entry: IndexedTask, input: EmbeddedSubtaskInput): Promise<EmbeddedSubtask> {
		const subtask = prepareEmbeddedSubtask(input);
		const document = structuredClone(entry.document);
		document.subtasks = upsertEmbeddedSubtask(document.subtasks ?? '', subtask);
		await this.save(entry, document);
		return subtask;
	}

	async updateEmbeddedSubtask(entry: IndexedTask, subtask: EmbeddedSubtask): Promise<void> {
		const current = this.embeddedSubtasks(entry).find((item) => item.id === subtask.id);
		if (!current) throw new Error('子任务不存在或已被删除。');
		const next = patchEmbeddedSubtask(current, subtask);
		const document = structuredClone(entry.document);
		document.subtasks = upsertEmbeddedSubtask(document.subtasks ?? '', next);
		await this.save(entry, document);
	}

	async toggleEmbeddedSubtask(entry: IndexedTask, subtaskId: string, completed: boolean): Promise<void> {
		const current = this.embeddedSubtasks(entry).find((item) => item.id === subtaskId);
		if (!current) throw new Error('子任务不存在或已被删除。');
		await this.updateEmbeddedSubtask(entry, { ...current, completed });
	}

	async deleteEmbeddedSubtask(entry: IndexedTask, subtaskId: string): Promise<void> {
		const document = structuredClone(entry.document);
		document.subtasks = removeEmbeddedSubtask(document.subtasks ?? '', subtaskId);
		await this.save(entry, document);
	}
}