import { expect, it } from 'vitest';
import type { IndexedTask } from '../../src/index/task-index';
import { collectTaskDataIssues } from '../../src/index/data-issues';

it('reports filename mismatches and missing relation targets', () => {
	const project = { kind: 'project' as const, schema: 1 as const, uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PROJ', name: '项目', active: true, taskDirectory: '任务', groupByMonth: false, nextNumber: 1, taskTypes: [], customFields: [], workflow: { initialStatusId: 'waiting', statuses: [{ id: 'waiting', name: '等待', category: 'todo' as const, result: null, active: true }, { id: 'done', name: '完成', category: 'done' as const, result: 'completed' as const, active: true }], transitions: [] } };
	const task: IndexedTask = { path: '任务/WRONG.md', project, document: { metadata: { kind: 'task', schema: 1, uid: '550e8400-e29b-41d4-a716-446655440000', key: 'PROJ-1', projectUid: project.uid, title: '任务', taskTypeId: 'task', createdAt: '2026-07-12T10:00:00+08:00', startDate: null, dueDate: null, completedAt: null, terminatedAt: null, reporterId: '660e8400-e29b-41d4-a716-446655440000', assigneeId: null, statusId: 'waiting', tags: [], custom: {} }, body: '', relations: [{ id: '770e8400-e29b-41d4-a716-446655440000', type: 'related', targetUid: '880e8400-e29b-41d4-a716-446655440000', targetKey: 'PROJ-2', targetTitle: '缺失' }], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n' } };
	const issues = collectTaskDataIssues([task]);
	expect(issues.map((item) => item.issue.code)).toEqual(expect.arrayContaining(['filename-key-mismatch', 'relation-target-missing']));
});

it('reports parent self references and cross-project parents from edited Markdown', () => {
	const makeTask = (uid: string, key: string, projectUid: string): IndexedTask => {
		const project = { kind: 'project' as const, schema: 1 as const, uid: projectUid, code: key.split('-')[0]!, name: key, active: true, taskDirectory: '任务', groupByMonth: false, nextNumber: 1, taskTypes: [], customFields: [], workflow: { initialStatusId: 'waiting', statuses: [{ id: 'waiting', name: '等待', category: 'todo' as const, result: null, active: true }], transitions: [] } };
		return { path: `任务/${key}.md`, project, document: { metadata: { kind: 'task', schema: 1, uid, key, projectUid, title: key, taskTypeId: 'task', createdAt: '2026-07-12T10:00:00+08:00', startDate: null, dueDate: null, completedAt: null, terminatedAt: null, reporterId: '660e8400-e29b-41d4-a716-446655440000', assigneeId: null, statusId: 'waiting', tags: [], custom: {} }, body: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n' } };
	};
	const child = makeTask('550e8400-e29b-41d4-a716-446655440000', 'ONE-1', '778de407-26bf-45ee-b22e-cf1f0bc826ce');
	const other = makeTask('880e8400-e29b-41d4-a716-446655440000', 'TWO-1', '998de407-26bf-45ee-b22e-cf1f0bc826ce');
	child.document.relations.push(
		{ id: '770e8400-e29b-41d4-a716-446655440000', type: 'parent', targetUid: child.document.metadata.uid, targetKey: child.document.metadata.key, targetTitle: child.document.metadata.title },
		{ id: '990e8400-e29b-41d4-a716-446655440000', type: 'parent', targetUid: other.document.metadata.uid, targetKey: other.document.metadata.key, targetTitle: other.document.metadata.title },
	);

	const codes = collectTaskDataIssues([child, other]).map((item) => item.issue.code);
	expect(codes).toEqual(expect.arrayContaining(['parent-self-reference', 'parent-cross-project', 'multiple-parents']));
});
