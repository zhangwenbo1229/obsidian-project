import type {
	ProjectConfig,
	TaskDocument,
	ValidationIssue,
	WorkflowStatus,
} from '../domain/types';

export interface IndexedTask {
	path: string;
	document: TaskDocument;
	project: ProjectConfig;
}

export interface IndexIssue extends ValidationIssue {
	paths: string[];
}

export interface TaskStatistics {
	completed: number;
	terminated: number;
	incomplete: number;
	overdue: number;
	completionRate: number;
}

export class TaskIndex {
	private sourceByPath = new Map<string, IndexedTask>();
	private valid: IndexedTask[] = [];
	private byUid = new Map<string, IndexedTask>();
	private indexIssues: IndexIssue[] = [];

	replace(tasks: IndexedTask[]): void {
		this.sourceByPath = new Map(tasks.map((task) => [task.path, task]));
		this.rebuild();
	}

	upsert(task: IndexedTask): void {
		this.sourceByPath.set(task.path, task);
		this.rebuild();
	}

	remove(path: string): void {
		this.sourceByPath.delete(path);
		this.rebuild();
	}

	private rebuild(): void {
		const tasks = [...this.sourceByPath.values()];
		this.valid = [];
		this.byUid.clear();
		this.indexIssues = [];

		const uidGroups = this.group(tasks, (task) => task.document.metadata.uid);
		const keyGroups = this.group(tasks, (task) => task.document.metadata.key);
		const invalidPaths = new Set<string>();
		this.recordConflicts(uidGroups, 'duplicate-uuid', '任务 UUID 重复。', invalidPaths);
		this.recordConflicts(keyGroups, 'duplicate-key', '任务 Key 重复。', invalidPaths);

		for (const task of tasks) {
			if (invalidPaths.has(task.path)) continue;
			this.valid.push(task);
			this.byUid.set(task.document.metadata.uid, task);
		}
	}

	private group(
		tasks: IndexedTask[],
		getKey: (task: IndexedTask) => string,
	): Map<string, IndexedTask[]> {
		const groups = new Map<string, IndexedTask[]>();
		for (const task of tasks) {
			const key = getKey(task);
			const group = groups.get(key) ?? [];
			group.push(task);
			groups.set(key, group);
		}
		return groups;
	}

	private recordConflicts(
		groups: Map<string, IndexedTask[]>,
		code: string,
		message: string,
		invalidPaths: Set<string>,
	): void {
		for (const [value, group] of groups) {
			if (group.length < 2) continue;
			const paths = group.map((task) => task.path);
			for (const path of paths) invalidPaths.add(path);
			this.indexIssues.push({ code, path: value, message, paths });
		}
	}

	validTasks(): readonly IndexedTask[] {
		return this.valid;
	}

	issues(): readonly IndexIssue[] {
		return this.indexIssues;
	}

	get(uid: string): IndexedTask | undefined {
		return this.byUid.get(uid);
	}

	childrenOf(parentUid: string): IndexedTask[] {
		return this.valid.filter((task) =>
			task.document.relations.some(
				(relation) => relation.type === 'parent' && relation.targetUid === parentUid,
			),
		);
	}

	relatedTo(uid: string): IndexedTask[] {
		const related = new Set<IndexedTask>();
		const source = this.byUid.get(uid);
		for (const task of this.valid) {
			if (
				task.document.relations.some(
					(relation) => relation.type === 'related' && relation.targetUid === uid,
				)
			) {
				related.add(task);
			}
		}
		for (const relation of source?.document.relations ?? []) {
			if (relation.type !== 'related') continue;
			const target = this.byUid.get(relation.targetUid);
			if (target) related.add(target);
		}
		return [...related];
	}

	statistics(today: string): TaskStatistics {
		let completed = 0;
		let terminated = 0;
		let incomplete = 0;
		let overdue = 0;
		for (const task of this.valid) {
			const status = this.statusOf(task);
			if (status?.category === 'done' && status.result === 'completed') {
				completed += 1;
			} else if (status?.category === 'done' && status.result === 'terminated') {
				terminated += 1;
			} else {
				incomplete += 1;
				const dueDate = task.document.metadata.dueDate;
				if (dueDate && dueDate < today) overdue += 1;
			}
		}
		const denominator = completed + incomplete;
		return {
			completed,
			terminated,
			incomplete,
			overdue,
			completionRate: denominator === 0 ? 0 : completed / denominator,
		};
	}

	private statusOf(task: IndexedTask): WorkflowStatus | undefined {
		return task.project.workflow.statuses.find(
			(status) => status.id === task.document.metadata.statusId,
		);
	}
}
