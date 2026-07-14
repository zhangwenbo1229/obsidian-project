import { describe, expect, it } from 'vitest';
import type { ProjectConfig, TaskDocument } from '../../src/domain/types';
import { TaskIndex } from '../../src/index/task-index';

const project: ProjectConfig = {
	kind: 'project', schema: 1, uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PROJ', name: '项目', active: true,
	taskDirectory: '任务', groupByMonth: false, nextNumber: 10,
	taskTypes: [{ id: 'task', name: '任务', icon: 'check', color: '#000', active: true, template: null }],
	customFields: [],
	workflow: {
		initialStatusId: 'waiting',
		statuses: [
			{ id: 'waiting', name: '待处理', category: 'todo', result: null, active: true },
			{ id: 'doing', name: '进行中', category: 'in_progress', result: null, active: true },
			{ id: 'done', name: '已完成', category: 'done', result: 'completed', active: true },
			{ id: 'cancelled', name: '已取消', category: 'done', result: 'terminated', active: true },
		], transitions: [],
	},
};

function task(uid: string, key: string, statusId = 'waiting'): TaskDocument {
	return {
		metadata: {
			kind: 'task', schema: 1, uid, key, projectUid: project.uid, title: key,
			taskTypeId: 'task', createdAt: '2026-07-01T10:00:00+08:00', startDate: null,
			dueDate: null, completedAt: null, terminatedAt: null,
			reporterId: '8a67a66f-0109-47b3-9463-5d05b4295949', assigneeId: null,
			statusId, tags: [], custom: {},
		}, body: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
	};
}

describe('task index', () => {
	it('excludes every task involved in UUID or key conflicts', () => {
		const index = new TaskIndex();
		const a = task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1');
		const duplicateUid = task(a.metadata.uid, 'PROJ-2');
		const duplicateKey = task('660e8400-e29b-41d4-a716-446655440000', 'PROJ-1');

		index.replace([
			{ path: 'a.md', document: a, project },
			{ path: 'b.md', document: duplicateUid, project },
			{ path: 'c.md', document: duplicateKey, project },
		]);

		expect(index.validTasks()).toEqual([]);
		expect(index.issues().map((item) => item.code)).toEqual(
			expect.arrayContaining(['duplicate-uuid', 'duplicate-key']),
		);
	});

	it('computes reverse related and child relationships', () => {
		const parent = task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1');
		const child = task('660e8400-e29b-41d4-a716-446655440000', 'PROJ-2');
		child.relations.push({
			id: '770e8400-e29b-41d4-a716-446655440000', type: 'parent',
			targetUid: parent.metadata.uid, targetKey: parent.metadata.key, targetTitle: parent.metadata.title,
		});
		parent.relations.push({
			id: '880e8400-e29b-41d4-a716-446655440000', type: 'related',
			targetUid: child.metadata.uid, targetKey: child.metadata.key, targetTitle: child.metadata.title,
		});
		const index = new TaskIndex();
		index.replace([
			{ path: 'parent.md', document: parent, project },
			{ path: 'child.md', document: child, project },
		]);

		expect(index.childrenOf(parent.metadata.uid)[0]?.document.metadata.uid).toBe(child.metadata.uid);
		expect(index.relatedTo(child.metadata.uid)[0]?.document.metadata.uid).toBe(parent.metadata.uid);
	});

	it('calculates the confirmed completion and overdue statistics', () => {
		const waiting = task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1');
		waiting.metadata.dueDate = '2026-07-10';
		const done = task('660e8400-e29b-41d4-a716-446655440000', 'PROJ-2', 'done');
		const cancelled = task('770e8400-e29b-41d4-a716-446655440000', 'PROJ-3', 'cancelled');
		const index = new TaskIndex();
		index.replace([
			{ path: '1.md', document: waiting, project },
			{ path: '2.md', document: done, project },
			{ path: '3.md', document: cancelled, project },
		]);

		expect(index.statistics('2026-07-12')).toEqual({
			completed: 1, terminated: 1, incomplete: 1, overdue: 1, completionRate: 0.5,
		});
	});

	it('incrementally upserts and removes paths while rebuilding conflicts', () => {
		const index = new TaskIndex();
		const first = { path: '1.md', document: task('550e8400-e29b-41d4-a716-446655440000', 'PROJ-1'), project };
		const second = { path: '2.md', document: task('660e8400-e29b-41d4-a716-446655440000', 'PROJ-2'), project };
		index.replace([first]);

		index.upsert(second);
		expect(index.validTasks().map((item) => item.path)).toEqual(['1.md', '2.md']);
		index.upsert({ ...second, document: task('660e8400-e29b-41d4-a716-446655440000', 'PROJ-1') });
		expect(index.validTasks()).toEqual([]);
		index.remove('2.md');
		expect(index.validTasks().map((item) => item.path)).toEqual(['1.md']);
	});
});
