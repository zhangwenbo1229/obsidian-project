import type { TaskDocument, TaskRelation, ValidationIssue } from './types';
import type { TaskIndex } from '../index/task-index';
import type { IndexedTask } from '../index/task-index';

function issue(code: string, message: string): ValidationIssue {
	return { code, path: 'relations', message };
}

export function collectTaskTree(uid: string, index: TaskIndex): IndexedTask[] {
	const initial = index.get(uid);
	if (!initial) return [];
	let root: IndexedTask = initial;
	const visited = new Set<string>();
	while (!visited.has(root.document.metadata.uid)) {
		visited.add(root.document.metadata.uid);
		const parentUid: string | undefined = root.document.relations.find((relation) => relation.type === 'parent')?.targetUid;
		const parent: IndexedTask | undefined = parentUid ? index.get(parentUid) : undefined;
		if (!parent) break;
		root = parent;
	}
	const output: IndexedTask[] = [];
	const walk = (entry: IndexedTask) => {
		if (output.some((item) => item.document.metadata.uid === entry.document.metadata.uid)) return;
		output.push(entry);
		for (const child of index.childrenOf(entry.document.metadata.uid)) walk(child);
	};
	walk(root);
	return output;
}

export function validateParentAssignment(
	child: TaskDocument,
	parent: TaskDocument,
	index: TaskIndex,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	if (child.metadata.uid === parent.metadata.uid) {
		issues.push(issue('parent-self-reference', '任务不能成为自己的父任务。'));
	}
	if (child.metadata.projectUid !== parent.metadata.projectUid) {
		issues.push(issue('parent-cross-project', '父子任务必须属于同一项目。'));
	}

	const visited = new Set<string>();
	let current: TaskDocument | undefined = parent;
	while (current && !visited.has(current.metadata.uid)) {
		if (current.metadata.uid === child.metadata.uid) {
			issues.push(issue('parent-cycle', '父子关系会形成循环。'));
			break;
		}
		visited.add(current.metadata.uid);
		const parentRelation: TaskRelation | undefined = current.relations.find(
			(relation) => relation.type === 'parent',
		);
		current = parentRelation
			? index.get(parentRelation.targetUid)?.document
			: undefined;
	}
	return issues;
}
