import { describe, expect, it } from 'vitest';
import type { IndexedTask } from '../../src/index/task-index';
import { applyProjectListFieldValue, projectListEditorKind } from '../../src/views/project-list-inline-editor';

function indexed(): IndexedTask {
	const project = {
		kind: 'project', schema: 1, uid: '550e8400-e29b-41d4-a716-446655440000', code: 'PROJ', name: '项目', description: '', active: true,
		taskDirectory: '项目', sequencePadding: 3, groupByMonth: false, nextNumber: 2,
		taskTypes: [{ id: 'task', name: '任务', active: true, description: '', template: null }],
		workflow: {
			statuses: [{ id: 'todo', name: '待办', category: 'todo' }, { id: 'done', name: '完成', category: 'done', result: 'completed' }],
			transitions: [{ id: 'finish', name: '完成', from: 'todo', to: 'done' }],
		},
		customFields: [
			{ id: 'points', key: 'points', name: '点数', type: 'number', required: false, active: true, default: null },
			{ id: 'areas', key: 'areas', name: '区域', type: 'multi-select', required: false, active: true, default: [] },
			{ id: 'review', key: 'review', name: '评审时间', type: 'datetime', required: false, active: true, default: null },
		],
	} as unknown as IndexedTask['project'];
	return {
		path: '项目/PROJ-1.md', project,
		document: {
			metadata: {
				kind: 'task', schema: 1, uid: '660e8400-e29b-41d4-a716-446655440000', key: 'PROJ-1', projectUid: project.uid,
				title: '原项目', taskTypeId: 'task', priority: 'medium', createdAt: '2026-07-15T09:00:00+08:00',
				scheduledDate: null, startDate: null, dueDate: null, endDate: null, completedAt: null, terminatedAt: null,
				reporterId: '770e8400-e29b-41d4-a716-446655440000', assigneeId: null, statusId: 'todo', tags: ['old'], custom: {},
			},
			body: '', subtasks: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
		},
	};
}

describe('project list inline editor model', () => {
	it('selects editors only for mutable scalar and custom fields', () => {
		const task = indexed();
		expect(projectListEditorKind(task, 'title')).toBe('text');
		expect(projectListEditorKind(task, 'priority')).toBe('select');
		expect(projectListEditorKind(task, 'scheduledDate')).toBe('datetime-local');
		expect(projectListEditorKind(task, 'custom:points')).toBe('number');
		for (const field of ['key', 'project', 'relations', 'links', 'subtasks']) expect(projectListEditorKind(task, field)).toBeNull();
	});

	it('applies normalized built-in and custom values to a cloned document', () => {
		const task = indexed();
		expect(applyProjectListFieldValue(task, 'title', '  新项目  ').metadata.title).toBe('新项目');
		expect(applyProjectListFieldValue(task, 'tags', ' alpha, beta，alpha ').metadata.tags).toEqual(['alpha', 'beta']);
		expect(applyProjectListFieldValue(task, 'custom:points', '8').metadata.custom.points).toBe(8);
		expect(applyProjectListFieldValue(task, 'custom:areas', 'web, mobile').metadata.custom.areas).toEqual(['web', 'mobile']);
		expect(applyProjectListFieldValue(task, 'custom:review', '2026-07-16T10:30').metadata.custom.review)
			.toMatch(/^2026-07-16T10:30:00[+-]\d{2}:\d{2}$/u);
		const done = applyProjectListFieldValue(task, 'status', 'done', new Date('2026-07-15T02:00:00Z'));
		expect(done.metadata).toMatchObject({ statusId: 'done' });
		expect(done.metadata.completedAt).not.toBeNull();
	});
});
