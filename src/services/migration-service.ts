import type {
	ProjectConfig,
	TaskDocument,
	ValidationIssue,
} from '../domain/types';

export interface TaskMigrationChange {
	oldPath: string;
	newPath: string;
	oldKey: string;
	newKey: string;
	document: TaskDocument;
}

export interface MigrationPlan {
	changes: TaskMigrationChange[];
	issues: ValidationIssue[];
}

function taskPath(project: ProjectConfig, document: TaskDocument): string {
	const month = document.metadata.createdAt.slice(0, 7);
	const directory = project.groupByMonth
		? `${project.taskDirectory}/${month}`
		: project.taskDirectory;
	return `${directory}/${document.metadata.key}.md`;
}

export function planProjectCodeMigration(
	project: ProjectConfig,
	tasks: Array<{ path: string; document: TaskDocument }>,
	newCode: string,
	existingKeys: ReadonlySet<string>,
): MigrationPlan {
	const code = newCode.trim().toUpperCase();
	if (!/^[A-Z][A-Z0-9]*$/.test(code)) {
		return {
			changes: [],
			issues: [{ code: 'invalid-project-code', path: 'code', message: '项目代码格式无效。' }],
		};
	}
	const replacements = new Map<string, string>();
	for (const task of tasks) {
		const suffix = task.document.metadata.key.split('-').at(-1) ?? '';
		replacements.set(task.document.metadata.uid, `${code}-${suffix}`);
	}
	for (const newKey of replacements.values()) {
		if (existingKeys.has(newKey)) {
			return {
				changes: [],
				issues: [{ code: 'target-key-conflict', path: newKey, message: `目标 Key 已存在：${newKey}` }],
			};
		}
	}
	const nextProject = { ...project, code };
	if (project.taskDirectory.endsWith(`/${project.code}`)) {
		nextProject.taskDirectory = `${project.taskDirectory.slice(0, -(project.code.length))}${code}`;
	}
	const changes = tasks.map((task) => {
		const document = structuredClone(task.document);
		const oldKey = document.metadata.key;
		document.metadata.key = replacements.get(document.metadata.uid)!;
		for (const relation of document.relations) {
			const replacement = replacements.get(relation.targetUid);
			if (replacement) relation.targetKey = replacement;
		}
		return {
			oldPath: task.path,
			newPath: taskPath(nextProject, document),
			oldKey,
			newKey: document.metadata.key,
			document,
		};
	});
	return { changes, issues: [] };
}

export interface TransferMapping {
	taskTypeId: string;
	statusId: string;
	customFieldMappings: Record<string, string>;
}

export function prepareProjectTransfer(
	source: TaskDocument,
	target: ProjectConfig,
	mapping: TransferMapping,
	existingKeys: ReadonlySet<string>,
	startingNumber = target.nextNumber,
): { document: TaskDocument; path: string; nextNumber: number } {
	let number = startingNumber;
	while (existingKeys.has(`${target.code}-${number}`)) number += 1;
	const document = structuredClone(source);
	document.metadata.projectUid = target.uid;
	document.metadata.key = `${target.code}-${number}`;
	document.metadata.taskTypeId = mapping.taskTypeId;
	document.metadata.statusId = mapping.statusId;
	const custom: Record<string, unknown> = {};
	for (const [sourceKey, targetKey] of Object.entries(mapping.customFieldMappings)) {
		if (sourceKey in document.metadata.custom) {
			custom[targetKey] = document.metadata.custom[sourceKey];
		}
	}
	document.metadata.custom = custom;
	const status = target.workflow.statuses.find((item) => item.id === mapping.statusId);
	if (status?.category !== 'done') {
		document.metadata.completedAt = null;
		document.metadata.terminatedAt = null;
	} else if (status.result === 'completed') {
		document.metadata.terminatedAt = null;
	} else {
		document.metadata.completedAt = null;
	}
	return { document, path: taskPath(target, document), nextNumber: number + 1 };
}

export function changeCustomFieldKey(
	tasks: readonly TaskDocument[],
	oldKey: string,
	newKey: string,
): TaskDocument[] {
	if (tasks.some((task) => oldKey in task.metadata.custom && newKey in task.metadata.custom)) {
		throw new Error(`自定义字段 ${newKey} 已存在，不能覆盖。`);
	}
	return tasks.map((source) => {
		const task = structuredClone(source);
		if (oldKey in task.metadata.custom) {
			task.metadata.custom[newKey] = task.metadata.custom[oldKey];
			delete task.metadata.custom[oldKey];
		}
		return task;
	});
}

export function refreshRelationKeys(
	tasks: readonly TaskDocument[],
	keyByUid: ReadonlyMap<string, string>,
): TaskDocument[] {
	return tasks.map((source) => {
		const task = structuredClone(source);
		for (const relation of task.relations) {
			const key = keyByUid.get(relation.targetUid);
			if (key) relation.targetKey = key;
		}
		return task;
	});
}

export function resolveMigrationPath(
	oldPath: string,
	newPath: string,
	oldPathExists: boolean,
	newPathExists: boolean,
): { path: string; rename: boolean } {
	if (oldPath === newPath) {
		if (!oldPathExists && !newPathExists) throw new Error(`迁移文件不存在：${oldPath}`);
		return { path: oldPath, rename: false };
	}
	if (oldPathExists && newPathExists) throw new Error(`迁移的新旧路径同时存在：${oldPath}、${newPath}`);
	if (oldPathExists) return { path: oldPath, rename: true };
	if (newPathExists) return { path: newPath, rename: false };
	throw new Error(`迁移的新旧路径均不存在：${oldPath}、${newPath}`);
}
