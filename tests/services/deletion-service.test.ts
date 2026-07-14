import { describe, expect, it } from 'vitest';
import type { IndexedTask } from '../../src/index/task-index';
import { TaskIndex } from '../../src/index/task-index';
import { planTaskDeletion } from '../../src/services/deletion-service';

function entry(uid: string, key: string): IndexedTask {
	const project = { kind: 'project' as const, schema: 1 as const, uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PROJ', name: '项目', active: true, taskDirectory: '任务', groupByMonth: false, nextNumber: 1, taskTypes: [], customFields: [], workflow: { initialStatusId: 'waiting', statuses: [{ id: 'waiting', name: '待处理', category: 'todo' as const, result: null, active: true }, { id: 'done', name: '完成', category: 'done' as const, result: 'completed' as const, active: true }], transitions: [] } };
	return { path: `${key}.md`, project, document: { metadata: { kind: 'task', schema: 1, uid, key, projectUid: project.uid, title: key, taskTypeId: 'task', createdAt: '2026-07-12T10:00:00+08:00', startDate: null, dueDate: null, completedAt: null, terminatedAt: null, reporterId: uid, assigneeId: null, statusId: 'waiting', tags: [], custom: {} }, body: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n' } };
}

describe('task deletion planning', () => {
	it('blocks deletion when the task has children', () => {
		const parent = entry('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1');
		const child = entry('660e8400-e29b-41d4-a716-446655440000', 'PROJ-2');
		child.document.relations.push({ id: '770e8400-e29b-41d4-a716-446655440000', type: 'parent', targetUid: parent.document.metadata.uid, targetKey: 'PROJ-1', targetTitle: 'PROJ-1' });
		const index = new TaskIndex(); index.replace([parent, child]);
		expect(planTaskDeletion(parent, index).issues[0]?.code).toBe('task-has-children');
	});

	it('returns edits that remove ordinary relations before trashing', () => {
		const target = entry('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1');
		const source = entry('660e8400-e29b-41d4-a716-446655440000', 'PROJ-2');
		source.document.relations.push({ id: '770e8400-e29b-41d4-a716-446655440000', type: 'related', targetUid: target.document.metadata.uid, targetKey: 'PROJ-1', targetTitle: 'PROJ-1' });
		const index = new TaskIndex(); index.replace([target, source]);
		const plan = planTaskDeletion(target, index);
		expect(plan.issues).toEqual([]);
		expect(plan.relatedEdits[0]?.document.relations).toEqual([]);
	});
});
