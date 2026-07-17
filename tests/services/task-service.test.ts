import { describe, expect, it } from 'vitest';
import type { GlobalConfig, ProjectConfig } from '../../src/domain/types';
import { applyTaskTemplate, prepareNewTask, resolveTaskTypeTemplate, switchTaskTypeDraft } from '../../src/services/task-service';
import * as taskService from '../../src/services/task-service';

const globalConfig: GlobalConfig = {
	kind: 'global-config', schema: 1, projectConfigDirectory: '项目管理/项目配置',
	defaultTaskDirectory: '项目管理/任务', currentUserId: '8a67a66f-0109-47b3-9463-5d05b4295949',
	people: [
		{ id: '8a67a66f-0109-47b3-9463-5d05b4295949', name: '张三', active: true },
		{ id: '9b67a66f-0109-47b3-9463-5d05b4295949', name: '李四', active: true },
	],
	personMetadataFields: [],
};
const project: ProjectConfig = {
	kind: 'project', schema: 1, uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PROJ', name: '项目', active: true,
	taskDirectory: '项目管理/任务/PROJ', groupByMonth: true, nextNumber: 3,
	taskTypes: [{ id: 'task', name: '任务', icon: 'check', color: '#000', active: true, template: '模板正文' }], customFields: [],
	workflow: { initialStatusId: 'waiting', statuses: [{ id: 'waiting', name: '待处理', category: 'todo', result: null, active: true }, { id: 'done', name: '完成', category: 'done', result: 'completed', active: true }], transitions: [] },
};

describe('task creation preparation', () => {
	it('uses the editable configured content for a task type', () => {
		expect(resolveTaskTypeTemplate({ ...project.taskTypes[0]!, template: '自定义 Markdown 内容' }))
			.toBe('自定义 Markdown 内容');
	});

	it('switches templates only while the task body is still unedited', () => {
		expect(applyTaskTemplate('', false, 'Template body')).toBe('Template body');
		expect(applyTaskTemplate('User body', true, 'Another template')).toBe('User body');
	});

	it('uses the next unused number and original local creation month', () => {
		const prepared = prepareNewTask({
			project, globalConfig, title: '新任务', taskTypeId: 'task', assigneeId: null,
			startDate: null, dueDate: null, tags: [], custom: {}, body: '',
		}, new Set(['PROJ-3']), new Date('2026-01-15T10:00:00+08:00'), () => '550e8400-e29b-41d4-a716-446655440000');

		expect(prepared.path).toBe('项目管理/任务/PROJ/2026-01/PROJ-4.md');
		expect(prepared.nextNumber).toBe(5);
		expect(prepared.document.metadata).toMatchObject({ key: 'PROJ-4', title: '新任务', statusId: 'waiting', priority: 'medium' });
		expect(prepared.document.body).toBe('模板正文');
	});

	it('rejects missing required custom fields', () => {
		const configured = structuredClone(project);
		configured.customFields.push({ id: 'severity', key: 'severity', name: '严重程度', type: 'text', required: true, active: true, default: null });
		expect(() => prepareNewTask({
			project: configured, globalConfig, title: '新任务', taskTypeId: 'task', assigneeId: null,
			startDate: null, dueDate: null, tags: [], custom: {}, body: '',
		}, new Set(), new Date(), () => '550e8400-e29b-41d4-a716-446655440000')).toThrow('必填');
	});

	it('applies configured custom field defaults', () => {
		const configured = structuredClone(project);
		configured.customFields.push({ id: 'severity', key: 'severity', name: '严重程度', type: 'text', required: false, active: true, default: '普通' });
		const prepared = prepareNewTask({ project: configured, globalConfig, title: '新任务', taskTypeId: 'task', assigneeId: null, startDate: null, dueDate: null, tags: [], custom: {}, body: '' }, new Set(), new Date(), () => '550e8400-e29b-41d4-a716-446655440000');
		expect(prepared.document.metadata.custom).toEqual({ severity: '普通' });
	});

	it('raises a stale project counter above the highest historical key', () => {
		const configured = structuredClone(project); configured.nextNumber = 1;
		const prepared = prepareNewTask({ project: configured, globalConfig, title: '同步后任务', taskTypeId: 'task', assigneeId: null, startDate: null, dueDate: null, tags: [], custom: {}, body: '' }, new Set(['PROJ-100']), new Date(), () => '550e8400-e29b-41d4-a716-446655440000');
		expect(prepared.document.metadata.key).toBe('PROJ-101');
	});

	it('keeps markdown links and creates an initial markdown note', () => {
		const prepared = prepareNewTask({
			project, globalConfig, title: 'Documented task', taskTypeId: 'task', assigneeId: null,
			startDate: null, dueDate: null, tags: [], custom: {}, body: '# Body',
			links: '- [[Architecture]]\n- https://example.com/spec',
			note: '**Review** this with the team.',
		}, new Set(), new Date('2026-07-13T10:00:00+08:00'), () => '550e8400-e29b-41d4-a716-446655440000');

		expect(prepared.document.unknownLinks).toEqual(['- [[Architecture]]', '- https://example.com/spec']);
		expect(prepared.document.notes).toEqual([
			expect.objectContaining({ authorName: '张三', content: '**Review** this with the team.' }),
		]);
	});

	it('preserves per-type drafts while switching task templates', () => {
		const first = switchTaskTypeDraft({}, 'task', 'Custom task body', 'bug', 'Bug template');
		expect(first.body).toBe('Bug template');
		expect(first.drafts.task).toBe('Custom task body');
		const second = switchTaskTypeDraft(first.drafts, 'bug', 'Edited bug body', 'task', 'Task template');
		expect(second.body).toBe('Custom task body');
	});

	it('preserves all per-type field drafts while switching templates', () => {
		const switchFields = (taskService as Record<string, unknown>).switchTaskTypeFieldDrafts as undefined | ((
			drafts: Record<string, Record<string, unknown>>,
			currentTypeId: string,
			current: Record<string, unknown>,
			nextTypeId: string,
			defaults: Record<string, unknown>,
		) => { drafts: Record<string, Record<string, unknown>>; values: Record<string, unknown> });
		expect(typeof switchFields).toBe('function');
		if (!switchFields) return;
		const first = switchFields({}, 'task', { priority: 'high', links: 'task link' }, 'bug', { priority: 'low', links: '' });
		expect(first.values).toEqual({ priority: 'low', links: '' });
		const second = switchFields(first.drafts, 'bug', { priority: 'medium', links: 'bug link' }, 'task', { priority: 'low', links: '' });
		expect(second.values).toEqual({ priority: 'high', links: 'task link' });
	});

	it('creates Markdown subtasks, related tasks, and a note for the selected author', () => {
		const input = {
			project, globalConfig, title: 'Configured task', taskTypeId: 'task', assigneeId: null,
			reporterId: '9b67a66f-0109-47b3-9463-5d05b4295949', startDate: null, dueDate: null,
			tags: [], custom: {}, body: '', subtasks: '- [ ] 子任务 A',
			note: '由李四记录', noteAuthorId: '9b67a66f-0109-47b3-9463-5d05b4295949',
			relations: [{ id: 'relation-1', type: 'related', targetUid: 'target-1', targetKey: 'PROJ-1', targetTitle: '关联任务' }],
		} as Parameters<typeof prepareNewTask>[0] & Record<string, unknown>;
		const prepared = prepareNewTask(input, new Set(), new Date('2026-07-13T10:00:00+08:00'), () => 'generated-id');
		expect(prepared.document.metadata.reporterId).toBe('9b67a66f-0109-47b3-9463-5d05b4295949');
		expect((prepared.document as unknown as { subtasks: string }).subtasks).toBe('- [ ] 子任务 A');
		expect(prepared.document.relations).toEqual([expect.objectContaining({ type: 'related', targetUid: 'target-1' })]);
		expect(prepared.document.notes[0]).toMatchObject({ authorId: '9b67a66f-0109-47b3-9463-5d05b4295949', authorName: '李四' });
	});
});
