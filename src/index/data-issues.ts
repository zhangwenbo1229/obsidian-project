import type { ValidationIssue } from '../domain/types';
import type { IndexedTask } from './task-index';

export interface PathIssue {
	path: string;
	issue: ValidationIssue;
}

export function collectTaskDataIssues(tasks: readonly IndexedTask[]): PathIssue[] {
	const issues: PathIssue[] = [];
	const uids = new Set(tasks.map((task) => task.document.metadata.uid));
	const byUid = new Map(tasks.map((task) => [task.document.metadata.uid, task]));
	for (const task of tasks) {
		const filename = task.path.split('/').at(-1)?.replace(/\.md$/u, '');
		if (filename !== task.document.metadata.key) {
			issues.push({
				path: task.path,
				issue: { code: 'filename-key-mismatch', path: 'key', message: '文件名与任务 Key 不一致。' },
			});
		}
		for (const relation of task.document.relations) {
			if (!uids.has(relation.targetUid)) {
				issues.push({
					path: task.path,
					issue: { code: 'relation-target-missing', path: 'relations', message: `关系目标不存在：${relation.targetKey}` },
				});
			}
		}
		const parents = task.document.relations.filter((relation) => relation.type === 'parent');
		if (parents.length > 1) {
			issues.push({ path: task.path, issue: { code: 'multiple-parents', path: 'relations', message: '一个任务只能有一个父任务。' } });
		}
		for (const relation of parents) {
			if (relation.targetUid === task.document.metadata.uid) {
				issues.push({ path: task.path, issue: { code: 'parent-self-reference', path: 'relations', message: '任务不能成为自己的父任务。' } });
			}
			const parent = byUid.get(relation.targetUid);
			if (parent && parent.document.metadata.projectUid !== task.document.metadata.projectUid) {
				issues.push({ path: task.path, issue: { code: 'parent-cross-project', path: 'relations', message: '父子任务必须属于同一项目。' } });
			}
		}
		const visited = new Set([task.document.metadata.uid]);
		let current = task;
		while (true) {
			const parentUid = current.document.relations.find((relation) => relation.type === 'parent')?.targetUid;
			if (!parentUid) break;
			if (visited.has(parentUid)) {
				if (parentUid !== task.document.metadata.uid || current !== task) {
					issues.push({ path: task.path, issue: { code: 'parent-cycle', path: 'relations', message: '父子关系形成了循环。' } });
				}
				break;
			}
			visited.add(parentUid);
			const parent = byUid.get(parentUid);
			if (!parent) break;
			current = parent;
		}
	}
	return issues;
}
