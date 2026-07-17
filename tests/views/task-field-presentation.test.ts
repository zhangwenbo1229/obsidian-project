import { describe, expect, it } from 'vitest';
import type { IndexedTask } from '../../src/index/task-index';
import { resolveTaskFieldPresentation } from '../../src/views/task-field-presentation';

function task(): IndexedTask {
	return {
		path: 'tasks/PROJ-1.md',
		project: {
			kind: 'project', schema: 1, uid: 'project', code: 'PROJ', name: 'Project', active: true,
			taskDirectory: 'tasks', groupByMonth: false, nextNumber: 2, templateIds: [],
			taskTypes: [{
				id: 'task', name: 'Task', icon: 'circle-check', color: '#123456', titleColor: '#654321',
				active: true, template: '', fieldConfig: {
					title: { enabled: true, required: true, icon: 'heading', color: '#aa0000' },
					dueDate: { enabled: true, required: false, icon: 'calendar-clock', color: '#008800' },
				},
			}],
			customFields: [{
				id: 'risk', key: 'risk', name: 'Risk', type: 'text', required: false, active: true,
				default: '', icon: 'triangle-alert', color: '#cc6600',
			}],
			workflow: { initialStatusId: 'todo', statuses: [{ id: 'todo', name: 'Todo', category: 'todo', result: null, active: true }], transitions: [] },
		},
		document: {
			metadata: {
				kind: 'task', schema: 1, uid: 'task', key: 'PROJ-1', projectUid: 'project', title: 'Title',
				taskTypeId: 'task', priority: 'medium', createdAt: '2026-07-15T09:00:00+08:00', startDate: null,
				dueDate: null, completedAt: null, terminatedAt: null, reporterId: 'person', assigneeId: null,
				statusId: 'todo', tags: [], custom: { risk: 'high' },
			},
			body: '', subtasks: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
		},
	};
}

describe('task field presentation', () => {
	it('resolves built-in template field styles for every task surface', () => {
		expect(resolveTaskFieldPresentation(task(), 'dueDate')).toEqual({ icon: 'calendar-clock', color: '#008800' });
	});

	it('uses the configured title field before the task type title fallback', () => {
		expect(resolveTaskFieldPresentation(task(), 'title')).toEqual({ icon: 'heading', color: '#aa0000' });
		const value = task();
		value.project.taskTypes[0]!.fieldConfig!.title!.color = undefined;
		expect(resolveTaskFieldPresentation(value, 'title').color).toBe('#654321');
	});

	it('resolves independent custom field styles', () => {
		expect(resolveTaskFieldPresentation(task(), 'custom:risk')).toEqual({ icon: 'triangle-alert', color: '#cc6600' });
	});
});
