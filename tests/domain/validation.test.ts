import { describe, expect, it } from 'vitest';
import {
	isIsoDate,
	isIsoDateTimeWithOffset,
	isTaskKey,
	isUuidV4,
	validateCustomFieldValue,
	validateGlobalConfig,
	validateProjectConfig,
	validateTaskMetadata,
	validateTaskReferences,
} from '../../src/domain/validation';
import type {
	GlobalConfig,
	ProjectConfig,
	TaskMetadata,
} from '../../src/domain/types';

const userId = '8a67a66f-0109-47b3-9463-5d05b4295949';
const projectId = '778de407-26bf-45ee-b22e-cf1f0bc826ce';
const taskId = '550e8400-e29b-41d4-a716-446655440000';

function makeProject(): ProjectConfig {
	return {
		kind: 'project',
		schema: 1,
		uid: projectId,
		code: 'PROJ',
		name: '示例项目',
		active: true,
		taskDirectory: '项目管理/任务/PROJ',
		groupByMonth: true,
		nextNumber: 1,
		taskTypes: [
			{
				id: 'task',
				name: '任务',
				icon: 'circle-check',
				color: '#3b82f6',
				active: true,
				template: null,
			},
		],
		customFields: [],
		workflow: {
			initialStatusId: 'waiting',
			statuses: [
				{
					id: 'waiting',
					name: '待处理',
					category: 'todo',
					result: null,
					active: true,
				},
				{
					id: 'completed',
					name: '已完成',
					category: 'done',
					result: 'completed',
					active: true,
				},
			],
			transitions: [
				{
					id: 'finish',
					name: '完成',
					from: 'waiting',
					to: 'completed',
				},
			],
		},
	};
}

function makeTask(): TaskMetadata {
	return {
		kind: 'task',
		schema: 1,
		uid: taskId,
		key: 'PROJ-1',
		projectUid: projectId,
		title: '编写数据模型',
		taskTypeId: 'task',
		createdAt: '2026-07-12T14:30:00+08:00',
		startDate: null,
		dueDate: null,
		completedAt: null,
		terminatedAt: null,
		reporterId: userId,
		assigneeId: null,
		statusId: 'waiting',
		tags: [],
		custom: {},
	};
}

describe('primitive validation', () => {
	it('accepts only RFC 4122 UUID v4 identifiers', () => {
		expect(isUuidV4(taskId)).toBe(true);
		expect(isUuidV4('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
		expect(isUuidV4('not-a-uuid')).toBe(false);
	});

	it('accepts uppercase project keys with positive numbers', () => {
		expect(isTaskKey('PROJ-123')).toBe(true);
		expect(isTaskKey('P2-1')).toBe(true);
		expect(isTaskKey('proj-1')).toBe(false);
		expect(isTaskKey('PROJ-0')).toBe(false);
	});

	it('validates real calendar dates and zoned date-times', () => {
		expect(isIsoDate('2024-02-29')).toBe(true);
		expect(isIsoDate('2026-02-29')).toBe(false);
		expect(isIsoDateTimeWithOffset('2026-07-12T14:30:00+08:00')).toBe(true);
		expect(isIsoDateTimeWithOffset('2026-07-12T14:30:00')).toBe(false);
	});
});

describe('global config validation', () => {
	it('requires the current user to exist in the shared people list', () => {
		const config: GlobalConfig = {
			kind: 'global-config',
			schema: 1,
			projectConfigDirectory: '项目管理/项目配置',
			defaultTaskDirectory: '项目管理/任务',
			currentUserId: userId,
			people: [],
			personMetadataFields: [],
		};

		const result = validateGlobalConfig(config);

		expect(result.success).toBe(false);
		expect(result.issues).toContainEqual(
			expect.objectContaining({ code: 'current-user-missing' }),
		);
	});
});

describe('project validation', () => {
	it('accepts a project with an initial state and a completion state', () => {
		expect(validateProjectConfig(makeProject())).toEqual({
			success: true,
			data: makeProject(),
			issues: [],
		});
	});

	it('rejects done statuses without a completion result', () => {
		const project = makeProject();
		project.workflow.statuses[1]!.result = null;

		const result = validateProjectConfig(project);

		expect(result.success).toBe(false);
		expect(result.issues).toContainEqual(
			expect.objectContaining({ code: 'invalid-status-result' }),
		);
	});

	it('rejects transitions that reference unknown statuses', () => {
		const project = makeProject();
		project.workflow.transitions[0]!.to = 'missing';

		const result = validateProjectConfig(project);

		expect(result.success).toBe(false);
		expect(result.issues).toContainEqual(
			expect.objectContaining({ code: 'transition-status-missing' }),
		);
	});

	it('rejects reserved custom keys and templates containing reserved sections', () => {
		const project = makeProject();
		(project.customFields ?? []).push({ id: 'field', key: 'title', name: '冲突字段', type: 'text', required: false, active: true, default: null });
		project.taskTypes[0]!.template = '## 备注\n不允许';
		const result = validateProjectConfig(project);
		expect(result.success).toBe(false);
		expect(result.issues.map((item) => item.code)).toEqual(expect.arrayContaining(['invalid-custom-field-key', 'reserved-template-heading']));
	});

	it('keeps the legacy priority custom-field key available beside built-in task priority', () => {
		const project = makeProject();
		(project.customFields ?? []).push({ id: 'priority', key: 'priority', name: '优先级', type: 'text', required: false, active: true, default: null });
		expect(validateProjectConfig(project).issues).not.toContainEqual(
			expect.objectContaining({ code: 'invalid-custom-field-key' }),
		);
	});
});

describe('task validation', () => {
	it('accepts valid task metadata', () => {
		const task = makeTask();
		expect(validateTaskMetadata(task)).toEqual({
			success: true,
			data: task,
			issues: [],
		});
	});

	it('accepts a non-empty custom project priority configured by its template', () => {
		const task = makeTask();
		task.priority = 'critical';
		expect(validateTaskMetadata(task).issues).not.toContainEqual(
			expect.objectContaining({ code: 'invalid-priority' }),
		);
	});

	it('accepts legacy dates and new zoned date-times for schedule fields', () => {
		const task = makeTask();
		task.startDate = '2026-07-12';
		task.dueDate = '2026-07-13T18:30:00+08:00';
		expect(validateTaskMetadata(task).issues).toEqual([]);
	});

	it('reports every invalid base field without discarding the input', () => {
		const task = makeTask();
		task.uid = 'invalid';
		task.key = 'proj-0';
		task.title = '   ';
		task.createdAt = '2026-07-12T14:30:00';
		task.dueDate = '2026-02-29';

		const result = validateTaskMetadata(task);

		expect(result.success).toBe(false);
		expect(result.issues.map((issue) => issue.code)).toEqual(
		expect.arrayContaining([
			'invalid-uuid',
			'invalid-key',
			'empty-title',
			'invalid-datetime',
			'invalid-date',
		]),
		);
	});

	it('validates project references and ending dates', () => {
		const task = makeTask();
		task.statusId = 'completed';
		const project = makeProject();
		const issues = validateTaskReferences(task, project, new Set([userId]));
		expect(issues).toContainEqual(expect.objectContaining({ code: 'completed-date-missing' }));
		task.completedAt = '2026-07-12T15:00:00+08:00';
		expect(validateTaskReferences(task, project, new Set([userId]))).toEqual([]);
	});
});

describe('custom field validation', () => {
	it('validates option ids and scalar types', () => {
		const field = {
			id: 'severity-field',
			key: 'severity',
			name: '严重程度',
			type: 'single-select' as const,
			required: true,
			active: true,
			default: 'normal',
			options: [
				{ id: 'normal', name: '普通' },
				{ id: 'critical', name: '严重' },
			],
		};

		expect(validateCustomFieldValue(field, 'critical')).toEqual([]);
		expect(validateCustomFieldValue(field, 'unknown')).toContainEqual(
			expect.objectContaining({ code: 'invalid-option' }),
		);
	});
});
