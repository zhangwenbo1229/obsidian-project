import { describe, expect, it } from 'vitest';
import type { ProjectConfig, TaskDocument } from '../../src/domain/types';
import {
	changeCustomFieldKey,
	planProjectCodeMigration,
	prepareProjectTransfer,
	refreshRelationKeys,
	resolveMigrationPath,
} from '../../src/services/migration-service';

function project(uid: string, code: string): ProjectConfig {
	return {
		kind: 'project', schema: 1, uid, code, name: code, active: true,
		taskDirectory: `项目管理/任务/${code}`, groupByMonth: true, nextNumber: 5,
		taskTypes: [{ id: 'task', name: '任务', icon: 'check', color: '#000', active: true, template: null }],
		customFields: [{ id: 'severity-id', key: 'severity', name: '严重程度', type: 'text', required: false, active: true, default: null }],
		workflow: { initialStatusId: 'waiting', statuses: [{ id: 'waiting', name: '待处理', category: 'todo', result: null, active: true }, { id: 'done', name: '完成', category: 'done', result: 'completed', active: true }], transitions: [] },
	};
}

function task(projectConfig: ProjectConfig, key: string): TaskDocument {
	return {
		metadata: { kind: 'task', schema: 1, uid: crypto.randomUUID(), key, projectUid: projectConfig.uid, title: key, taskTypeId: 'task', createdAt: '2026-01-15T10:00:00+08:00', startDate: null, dueDate: null, completedAt: null, terminatedAt: null, reporterId: crypto.randomUUID(), assigneeId: null, statusId: 'waiting', tags: [], custom: { severity: '高' } },
		body: '', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
	};
}

describe('migration planning', () => {
	it('changes project code while preserving numeric suffixes and UUIDs', () => {
		const source = project('778de407-26bf-45ee-b22e-cf1f0bc826ce', 'PROJ');
		const document = task(source, 'PROJ-12');

		const plan = planProjectCodeMigration(source, [{ path: '项目管理/任务/PROJ/2026-01/PROJ-12.md', document }], 'OPS', new Set());

		expect(plan.issues).toEqual([]);
		expect(plan.changes[0]).toMatchObject({ oldKey: 'PROJ-12', newKey: 'OPS-12', newPath: '项目管理/任务/OPS/2026-01/OPS-12.md' });
		expect(plan.changes[0]?.document.metadata.uid).toBe(document.metadata.uid);
	});

	it('rejects all project-code changes when any target key conflicts', () => {
		const source = project('778de407-26bf-45ee-b22e-cf1f0bc826ce', 'PROJ');
		const plan = planProjectCodeMigration(source, [{ path: 'PROJ-12.md', document: task(source, 'PROJ-12') }], 'OPS', new Set(['OPS-12']));
		expect(plan.changes).toEqual([]);
		expect(plan.issues[0]?.code).toBe('target-key-conflict');
	});

	it('moves a task to a target project with a new key and mapped fields', () => {
		const source = project('778de407-26bf-45ee-b22e-cf1f0bc826ce', 'PROJ');
		const target = project('888de407-26bf-45ee-b22e-cf1f0bc826ce', 'OPS');
		const prepared = prepareProjectTransfer(task(source, 'PROJ-12'), target, {
			taskTypeId: 'task', statusId: 'waiting', customFieldMappings: { severity: 'severity' },
		}, new Set(), 5);
		expect(prepared.document.metadata).toMatchObject({ projectUid: target.uid, key: 'OPS-5', custom: { severity: '高' } });
		expect(prepared.path).toBe('项目管理/任务/OPS/2026-01/OPS-5.md');
	});

	it('renames a custom field without overwriting an existing target key', () => {
		const source = project('778de407-26bf-45ee-b22e-cf1f0bc826ce', 'PROJ');
		const document = task(source, 'PROJ-1');
		expect(changeCustomFieldKey([document], 'severity', 'priority')[0]?.metadata.custom).toEqual({ priority: '高' });
		document.metadata.custom.priority = 'existing';
		expect(() => changeCustomFieldKey([document], 'severity', 'priority')).toThrow('已存在');
	});

	it('can continue a partially completed custom-field migration', () => {
		const source = project('778de407-26bf-45ee-b22e-cf1f0bc826ce', 'PROJ');
		const oldTask = task(source, 'PROJ-1');
		const completedTask = task(source, 'PROJ-2');
		completedTask.metadata.custom = { priority: '高' };
		const result = changeCustomFieldKey([oldTask, completedTask], 'severity', 'priority');
		expect(result.map((item) => item.metadata.custom)).toEqual([{ priority: '高' }, { priority: '高' }]);
	});

	it('refreshes readable relation keys in tasks outside the migrated project', () => {
		const source = project('778de407-26bf-45ee-b22e-cf1f0bc826ce', 'PROJ');
		const target = task(source, 'PROJ-1');
		const otherProject = project('888de407-26bf-45ee-b22e-cf1f0bc826ce', 'OTHER');
		const external = task(otherProject, 'OTHER-1');
		external.relations.push({ id: crypto.randomUUID(), type: 'related', targetUid: target.metadata.uid, targetKey: 'PROJ-1', targetTitle: target.metadata.title });
		const changed = refreshRelationKeys([external], new Map([[target.metadata.uid, 'OPS-1']]));
		expect(changed[0]?.relations[0]?.targetKey).toBe('OPS-1');
	});

	it('resumes from either the old or already-renamed migration path without guessing conflicts', () => {
		expect(resolveMigrationPath('old.md', 'new.md', true, false)).toEqual({ path: 'old.md', rename: true });
		expect(resolveMigrationPath('old.md', 'new.md', false, true)).toEqual({ path: 'new.md', rename: false });
		expect(resolveMigrationPath('same.md', 'same.md', true, true)).toEqual({ path: 'same.md', rename: false });
		expect(() => resolveMigrationPath('old.md', 'new.md', true, true)).toThrow('同时存在');
		expect(() => resolveMigrationPath('old.md', 'new.md', false, false)).toThrow('均不存在');
	});
});
