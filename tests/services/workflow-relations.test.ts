import { describe, expect, it } from 'vitest';
import type { ProjectConfig, TaskDocument } from '../../src/domain/types';
import { transitionTask } from '../../src/domain/workflow';
import { collectTaskTree, validateParentAssignment } from '../../src/domain/relations';
import { TaskIndex } from '../../src/index/task-index';

const project: ProjectConfig = {
	kind: 'project', schema: 1, uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PROJ', name: '项目', active: true,
	taskDirectory: '任务', groupByMonth: false, nextNumber: 1, taskTypes: [], customFields: [],
	workflow: {
		initialStatusId: 'waiting',
		statuses: [
			{ id: 'waiting', name: '待处理', category: 'todo', result: null, active: true },
			{ id: 'doing', name: '进行中', category: 'in_progress', result: null, active: true },
			{ id: 'done', name: '完成', category: 'done', result: 'completed', active: true },
			{ id: 'cancelled', name: '取消', category: 'done', result: 'terminated', active: true },
		],
		transitions: [
			{ id: 'start', name: '开始', from: 'waiting', to: 'doing' },
			{ id: 'finish', name: '完成', from: 'doing', to: 'done' },
			{ id: 'reopen', name: '重开', from: 'done', to: 'waiting' },
		],
	},
};

function task(uid: string, key: string): TaskDocument {
	return {
		metadata: {
			kind: 'task', schema: 1, uid, key, projectUid: project.uid, title: key, taskTypeId: 'task',
			createdAt: '2026-07-12T09:00:00+08:00', startDate: null, dueDate: null,
			completedAt: null, terminatedAt: null, reporterId: uid, assigneeId: null,
			statusId: 'waiting', tags: [], custom: {},
		}, body: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
	};
}

describe('workflow transitions', () => {
	it('sets start and completion dates and clears them when reopened', () => {
		const metadata = task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1').metadata;
		const doing = transitionTask(metadata, project.workflow, 'doing', new Date('2026-07-12T10:00:00+08:00'));
		const done = transitionTask(doing, project.workflow, 'done', new Date('2026-07-13T11:00:00+08:00'));
		const reopened = transitionTask(done, project.workflow, 'waiting', new Date('2026-07-14T12:00:00+08:00'));

		expect(new Date(doing.startDate!).getTime()).toBe(new Date('2026-07-12T10:00:00+08:00').getTime());
		expect(new Date(done.completedAt!).getTime()).toBe(new Date('2026-07-13T11:00:00+08:00').getTime());
		expect(reopened.completedAt).toBeNull();
		expect(reopened.terminatedAt).toBeNull();
	});

	it('rejects transitions that are not configured', () => {
		const metadata = task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1').metadata;
		expect(() => transitionTask(metadata, project.workflow, 'done')).toThrow('不允许');
	});
});

describe('parent relationships', () => {
	it('rejects a cycle through an existing ancestor', () => {
		const a = task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1');
		const b = task('660e8400-e29b-41d4-a716-446655440000', 'PROJ-2');
		b.relations.push({ id: '770e8400-e29b-41d4-a716-446655440000', type: 'parent', targetUid: a.metadata.uid, targetKey: a.metadata.key, targetTitle: a.metadata.title });
		const index = new TaskIndex();
		index.replace([{ path: 'a', document: a, project }, { path: 'b', document: b, project }]);

		const issues = validateParentAssignment(a, b, index);

		expect(issues).toContainEqual(expect.objectContaining({ code: 'parent-cycle' }));
	});

	it('collects the root and every descendant for tree migration', () => {
		const a = task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1');
		const b = task('660e8400-e29b-41d4-a716-446655440000', 'PROJ-2');
		b.relations.push({ id: '770e8400-e29b-41d4-a716-446655440000', type: 'parent', targetUid: a.metadata.uid, targetKey: a.metadata.key, targetTitle: a.metadata.title });
		const index = new TaskIndex(); index.replace([{ path: 'a', document: a, project }, { path: 'b', document: b, project }]);
		expect(collectTaskTree(b.metadata.uid, index).map((item) => item.document.metadata.uid)).toEqual([a.metadata.uid, b.metadata.uid]);
	});
});
