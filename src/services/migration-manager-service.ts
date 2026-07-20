import type { ProjectConfig } from '../domain/types';
import { MigrationJournal } from '../repositories/migration-journal';
import { createUuid } from '../utils/ids';
import {
	changeCustomFieldKey,
	planProjectCodeMigration,
	prepareProjectTransfer,
	refreshRelationKeys,
	resolveMigrationPath,
	type TransferMapping,
} from './migration-service';
import { collectTaskTree } from '../domain/relations';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from './project-manager';

export class MigrationManagerService {
	constructor(private readonly pm: ProjectManager) {}

	async renameCustomFieldKey(
		project: ProjectConfig,
		fieldId: string,
		newKey: string,
	): Promise<void> {
		const field = (project.customFields ?? []).find((item) => item.id === fieldId);
		if (!field) throw new Error('自定义字段不存在。');
		if (field.key === newKey) return;
		const entries = this.pm.index.validTasks().filter((task) => task.project.uid === project.uid);
		const changed = changeCustomFieldKey(entries.map((entry) => entry.document), field.key, newKey);
		const journal = new MigrationJournal(this.pm.vault, createUuid());
		await journal.create(
			'custom-field-key',
			entries.map((entry, index) => ({
				uid: entry.document.metadata.uid,
				oldPath: entry.path,
				newPath: entry.path,
				oldKey: entry.document.metadata.key,
				newKey: entry.document.metadata.key,
				projectUid: project.uid,
				document: changed[index]!,
				baseline: entry.document,
				removedCustomKeys: [field.key],
			})),
			{ type: 'custom-field-key', projectUid: project.uid, fieldId, newKey },
		);
		for (const [index, document] of changed.entries()) {
			const entry = entries[index]!;
			await this.pm.taskRepository.save(entry.path, document, project);
			await journal.complete(entry.document.metadata.uid);
		}
		field.key = newKey;
		this.pm.replaceProject(project);
		await this.pm.persistConfiguration();
		await journal.completeFinalization();
		await this.pm.reload();
	}

	async changeProjectCode(project: ProjectConfig, newCode: string): Promise<void> {
		const entries = this.pm.index.validTasks().filter((task) => task.project.uid === project.uid);
		const otherKeys = new Set(this.pm.index.validTasks().filter((task) => task.project.uid !== project.uid).map((task) => task.document.metadata.key));
		const plan = planProjectCodeMigration(project, entries, newCode, otherKeys);
		if (plan.issues.length > 0) throw new Error(plan.issues[0]!.message);
		for (const change of plan.changes) {
			if (change.oldPath !== change.newPath && await this.pm.vault.exists(change.newPath)) {
				throw new Error(`目标文件已存在：${change.newPath}`);
			}
		}
		const keyByUid = new Map(plan.changes.map((change) => [change.document.metadata.uid, change.newKey]));
		const externalEntries = this.pm.index.validTasks().filter((task) => task.project.uid !== project.uid && task.document.relations.some((relation) => keyByUid.has(relation.targetUid)));
		const refreshed = refreshRelationKeys(externalEntries.map((entry) => entry.document), keyByUid);
		const nextProject = structuredClone(project);
		const oldCode = nextProject.code;
		nextProject.code = newCode.trim().toUpperCase();
		if (nextProject.taskDirectory.endsWith(`/${oldCode}`)) {
			nextProject.taskDirectory = `${nextProject.taskDirectory.slice(0, -oldCode.length)}${nextProject.code}`;
		}
		const oldPath = `config:${project.uid}`;
		const newPath = oldPath;
		const entriesByUid = new Map(entries.map((entry) => [entry.document.metadata.uid, entry]));
		const journal = new MigrationJournal(this.pm.vault, createUuid());
		await journal.create(
			'project-code',
			[
				...plan.changes.map((change) => ({
					uid: change.document.metadata.uid,
					oldPath: change.oldPath,
					newPath: change.newPath,
					oldKey: change.oldKey,
					newKey: change.newKey,
					projectUid: project.uid,
					document: change.document,
					baseline: entriesByUid.get(change.document.metadata.uid)!.document,
				})),
				...externalEntries.map((entry, index) => ({
					uid: entry.document.metadata.uid,
					oldPath: entry.path,
					newPath: entry.path,
					oldKey: entry.document.metadata.key,
					newKey: entry.document.metadata.key,
					projectUid: entry.project.uid,
					document: refreshed[index]!,
					baseline: entry.document,
				})),
			],
			{ type: 'project-code', projectUid: project.uid, oldPath, newPath, project: nextProject },
		);
		for (const change of plan.changes) {
			this.pm.authorizedIdentities.set(change.newPath, {
				uid: change.document.metadata.uid,
				key: change.document.metadata.key,
			});
			if (change.oldPath !== change.newPath) {
				await this.pm.taskRepository.rename(change.oldPath, change.newPath);
			}
			await this.pm.taskRepository.save(change.newPath, change.document, project);
			await journal.complete(change.document.metadata.uid);
		}
		for (const [index, document] of refreshed.entries()) {
			const entry = externalEntries[index]!;
			await this.pm.taskRepository.save(entry.path, document, entry.project);
			await journal.complete(entry.document.metadata.uid);
		}
		this.pm.replaceProject(nextProject);
		await this.pm.persistConfiguration();
		await journal.completeFinalization();
		await this.pm.reload();
	}

	async transferTask(
		entry: IndexedTask,
		target: ProjectConfig,
		mapping: TransferMapping,
	): Promise<void> {
		if (entry.document.relations.some((relation) => relation.type === 'parent') || this.pm.index.childrenOf(entry.document.metadata.uid).length > 0) {
			throw new Error('存在父子关系的任务必须先解除关系或迁移整棵任务树。');
		}
		const existingKeys = new Set(this.pm.index.validTasks().map((task) => task.document.metadata.key));
		const prepared = prepareProjectTransfer(entry.document, target, mapping, existingKeys);
		this.pm.authorizedIdentities.set(prepared.path, {
			uid: prepared.document.metadata.uid,
			key: prepared.document.metadata.key,
		});
		if (await this.pm.vault.exists(prepared.path)) throw new Error(`目标文件已存在：${prepared.path}`);
		const keyByUid = new Map([[entry.document.metadata.uid, prepared.document.metadata.key]]);
		const externalEntries = this.pm.index.validTasks().filter((task) => task.document.metadata.uid !== entry.document.metadata.uid && task.document.relations.some((relation) => keyByUid.has(relation.targetUid)));
		const refreshed = refreshRelationKeys(externalEntries.map((task) => task.document), keyByUid);
		const journal = new MigrationJournal(this.pm.vault, createUuid());
		await journal.create('task-transfer', [
			{
				uid: entry.document.metadata.uid,
				oldPath: entry.path,
				newPath: prepared.path,
				oldKey: entry.document.metadata.key,
				newKey: prepared.document.metadata.key,
				projectUid: target.uid,
				document: prepared.document,
				baseline: entry.document,
				details: {
					discardedCustomFields: Object.fromEntries(
						Object.entries(entry.document.metadata.custom).filter(([key]) => !(key in mapping.customFieldMappings)),
					),
				},
			},
			...externalEntries.map((task, index) => ({
				uid: task.document.metadata.uid,
				oldPath: task.path,
				newPath: task.path,
				oldKey: task.document.metadata.key,
				newKey: task.document.metadata.key,
				projectUid: task.project.uid,
				document: refreshed[index]!,
				baseline: task.document,
			})),
		]);
		target.nextNumber = prepared.nextNumber;
		this.pm.replaceProject(target);
		await this.pm.persistConfiguration();
		await this.pm.taskRepository.rename(entry.path, prepared.path);
		await this.pm.taskRepository.save(prepared.path, prepared.document, target);
		await journal.complete(entry.document.metadata.uid);
		for (const [index, document] of refreshed.entries()) {
			const external = externalEntries[index]!;
			await this.pm.taskRepository.save(external.path, document, external.project);
			await journal.complete(external.document.metadata.uid);
		}
		await this.pm.reload();
	}

	async transferTaskTree(
		entry: IndexedTask,
		target: ProjectConfig,
		mapping: TransferMapping,
	): Promise<void> {
		const entries = collectTaskTree(entry.document.metadata.uid, this.pm.index);
		if (entries.length === 0) throw new Error('找不到任务树。');
		const existingKeys = new Set(this.pm.index.validTasks().map((task) => task.document.metadata.key));
		let nextNumber = target.nextNumber;
		const prepared = entries.map((item) => {
			const result = prepareProjectTransfer(item.document, target, mapping, existingKeys, nextNumber);
			nextNumber = result.nextNumber;
			existingKeys.add(result.document.metadata.key);
			return { entry: item, ...result };
		});
		const keyByUid = new Map(prepared.map((item) => [item.document.metadata.uid, item.document.metadata.key]));
		const refreshed = refreshRelationKeys(prepared.map((item) => item.document), keyByUid);
		const movedUids = new Set(prepared.map((item) => item.document.metadata.uid));
		const externalEntries = this.pm.index.validTasks().filter((task) => !movedUids.has(task.document.metadata.uid) && task.document.relations.some((relation) => keyByUid.has(relation.targetUid)));
		const refreshedExternal = refreshRelationKeys(externalEntries.map((task) => task.document), keyByUid);
		for (const item of prepared) {
			if (item.entry.path !== item.path && await this.pm.vault.exists(item.path)) throw new Error(`目标文件已存在：${item.path}`);
		}
		const journal = new MigrationJournal(this.pm.vault, createUuid());
		await journal.create('task-tree-transfer', [
			...prepared.map((item, index) => ({
				uid: item.document.metadata.uid,
				oldPath: item.entry.path,
				newPath: item.path,
				oldKey: item.entry.document.metadata.key,
				newKey: item.document.metadata.key,
				projectUid: target.uid,
				document: refreshed[index]!,
				baseline: item.entry.document,
				details: {
					discardedCustomFields: Object.fromEntries(
						Object.entries(item.entry.document.metadata.custom).filter(([key]) => !(key in mapping.customFieldMappings)),
					),
				},
			})),
			...externalEntries.map((task, index) => ({
				uid: task.document.metadata.uid,
				oldPath: task.path,
				newPath: task.path,
				oldKey: task.document.metadata.key,
				newKey: task.document.metadata.key,
				projectUid: task.project.uid,
				document: refreshedExternal[index]!,
				baseline: task.document,
			})),
		]);
		target.nextNumber = nextNumber;
		this.pm.replaceProject(target);
		await this.pm.persistConfiguration();
		for (const [index, item] of prepared.entries()) {
			this.pm.authorizedIdentities.set(item.path, {
				uid: refreshed[index]!.metadata.uid,
				key: refreshed[index]!.metadata.key,
			});
			await this.pm.taskRepository.rename(item.entry.path, item.path);
			await this.pm.taskRepository.save(item.path, refreshed[index]!, target);
			await journal.complete(item.document.metadata.uid);
		}
		for (const [index, document] of refreshedExternal.entries()) {
			const external = externalEntries[index]!;
			await this.pm.taskRepository.save(external.path, document, external.project);
			await journal.complete(external.document.metadata.uid);
		}
		await this.pm.reload();
	}

	async resumeMigration(id: string): Promise<void> {
		const state = (await MigrationJournal.listIncomplete(this.pm.vault)).find((item) => item.id === id);
		if (!state) throw new Error('找不到未完成的迁移。');
		const journal = new MigrationJournal(this.pm.vault, id);
		const projectsToSave = new Map<string, ProjectConfig>();
		for (const item of state.items.filter((candidate) => !candidate.completed)) {
			if (!item.document || !item.baseline || !item.projectUid) {
				throw new Error('该迁移日志来自旧版本，缺少安全继续所需的任务快照，请手动检查文件。');
			}
			const project = this.pm.projects.find((candidate) => candidate.uid === item.projectUid);
			if (!project) throw new Error(`迁移目标项目不存在：${item.projectUid}`);
			const match = item.newKey?.match(new RegExp(`^${project.code}-(\\d+)$`, 'u'));
			if (match) {
				const nextNumber = Number(match[1]) + 1;
				if (nextNumber > project.nextNumber) {
					project.nextNumber = nextNumber;
					projectsToSave.set(project.uid, project);
				}
			}
		}
		for (const project of projectsToSave.values()) this.pm.replaceProject(project);
		if (projectsToSave.size > 0) await this.pm.persistConfiguration();
		for (const item of state.items.filter((candidate) => !candidate.completed)) {
			const project = this.pm.projects.find((candidate) => candidate.uid === item.projectUid)!;
			const oldExists = await this.pm.vault.exists(item.oldPath);
			const newExists = item.oldPath === item.newPath ? oldExists : await this.pm.vault.exists(item.newPath);
			const action = resolveMigrationPath(item.oldPath, item.newPath, oldExists, newExists);
			this.pm.authorizedIdentities.set(item.newPath, {
				uid: item.document!.metadata.uid,
				key: item.document!.metadata.key,
			});
			if (action.rename) await this.pm.taskRepository.rename(action.path, item.newPath);
			await this.pm.taskRepository.save(item.newPath, structuredClone(item.document!), project, item.baseline);
			await journal.complete(item.uid);
		}
		if (state.finalization && state.finalized !== true) {
			const finalization = state.finalization;
			if (finalization.type === 'custom-field-key') {
				const project = this.pm.projects.find((candidate) => candidate.uid === finalization.projectUid);
				const field = (project?.customFields ?? []).find((candidate) => candidate.id === finalization.fieldId);
				if (!project || !field) throw new Error('无法完成自定义字段键迁移：项目或字段不存在。');
				field.key = finalization.newKey;
				this.pm.replaceProject(project);
				await this.pm.persistConfiguration();
			} else {
				this.pm.replaceProject(finalization.project);
				await this.pm.persistConfiguration();
			}
			await journal.completeFinalization();
		}
		await this.pm.reload();
	}
}
