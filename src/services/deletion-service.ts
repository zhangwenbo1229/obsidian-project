import type { ValidationIssue } from '../domain/types';
import type { IndexedTask, TaskIndex } from '../index/task-index';

export interface DeletionPlan {
	issues: ValidationIssue[];
	relatedEdits: IndexedTask[];
}

export function planTaskDeletion(
	target: IndexedTask,
	index: TaskIndex,
): DeletionPlan {
	if (target.document.relations.some((relation) => relation.type === 'parent')) {
		return {
			issues: [{ code: 'task-has-parent', path: target.path, message: '任务存在父任务，请先解除父子关系。' }],
			relatedEdits: [],
		};
	}
	if (index.childrenOf(target.document.metadata.uid).length > 0) {
		return {
			issues: [{ code: 'task-has-children', path: target.path, message: '任务存在子任务，请先解除或迁移子任务。' }],
			relatedEdits: [],
		};
	}
	const relatedEdits: IndexedTask[] = [];
	for (const entry of index.validTasks()) {
		if (entry.path === target.path) continue;
		const relations = entry.document.relations.filter(
			(relation) => relation.targetUid !== target.document.metadata.uid,
		);
		if (relations.length === entry.document.relations.length) continue;
		const copy = structuredClone(entry);
		copy.document.relations = relations;
		relatedEdits.push(copy);
	}
	return { issues: [], relatedEdits };
}
