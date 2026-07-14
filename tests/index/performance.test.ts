import { expect, it } from 'vitest';
import type { IndexedTask } from '../../src/index/task-index';
import { TaskIndex } from '../../src/index/task-index';

it('indexes and queries 1000 generated tasks within the desktop target', () => {
	const project = { kind: 'project' as const, schema: 1 as const, uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PERF', name: '性能', active: true, taskDirectory: '任务', groupByMonth: false, nextNumber: 1001, taskTypes: [], customFields: [], workflow: { initialStatusId: 'waiting', statuses: [{ id: 'waiting', name: '等待', category: 'todo' as const, result: null, active: true }, { id: 'done', name: '完成', category: 'done' as const, result: 'completed' as const, active: true }], transitions: [] } };
	const tasks: IndexedTask[] = Array.from({ length: 1000 }, (_, index) => ({ path: `PERF-${index + 1}.md`, project, document: { metadata: { kind: 'task', schema: 1, uid: crypto.randomUUID(), key: `PERF-${index + 1}`, projectUid: project.uid, title: `任务 ${index + 1}`, taskTypeId: 'task', createdAt: '2026-07-12T10:00:00+08:00', startDate: null, dueDate: null, completedAt: null, terminatedAt: null, reporterId: crypto.randomUUID(), assigneeId: null, statusId: 'waiting', tags: [], custom: {} }, body: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n' } }));
	const started = performance.now();
	const taskIndex = new TaskIndex(); taskIndex.replace(tasks); taskIndex.statistics('2026-07-12');
	expect(performance.now() - started).toBeLessThan(2000);
	expect(taskIndex.validTasks()).toHaveLength(1000);
});
