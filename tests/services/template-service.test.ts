import { describe, expect, it } from 'vitest';
import type { ProjectConfig, TaskConfigurationTemplate } from '../../src/domain/types';
import { applyConfigurationTemplate, applyConfigurationTemplates } from '../../src/services/template-service';

const template: TaskConfigurationTemplate = {
	id: 'standard',
	name: 'Standard delivery',
	description: 'Shared delivery workflow',
	taskTypes: [{ id: 'task', name: 'Task', icon: 'circle-check', color: '#0c66e4', active: true, template: '# Acceptance' }],
	customFields: [{ id: 'points', key: 'story-points', name: 'Story points', type: 'number', required: false, active: true, default: null }],
	workflow: {
		initialStatusId: 'todo',
		statuses: [{ id: 'todo', name: 'To do', category: 'todo', result: null, active: true }],
		transitions: [],
	},
};

const project = {
	kind: 'project', schema: 1, uid: 'project', code: 'PROJ', name: 'Project', active: true,
	taskDirectory: 'tasks/PROJ', groupByMonth: true, nextNumber: 1,
	taskTypes: [], customFields: [], workflow: { initialStatusId: '', statuses: [], transitions: [] },
} satisfies ProjectConfig;

describe('configuration templates', () => {
	it('applies a template to a project without sharing mutable objects', () => {
		const applied = applyConfigurationTemplate(project, template);
		expect(applied.templateId).toBe(template.id);
		expect(applied.taskTypes).toEqual(template.taskTypes);
		expect(applied.customFields).toEqual(template.customFields.map((field) => ({ ...field, taskTypeIds: ['task'] })));
		expect(applied.workflow).toEqual(template.workflow);
		applied.taskTypes[0]!.name = 'Changed';
		expect(template.taskTypes[0]!.name).toBe('Task');
	});

	it('merges enabled single-type templates and uses the first workflow', () => {
		const bug = structuredClone(template);
		bug.id = 'bug-template';
		bug.taskTypes = [{ id: 'bug', name: 'Bug', icon: 'bug', color: '#c9372c', active: true, template: '# Reproduce' }];
		bug.customFields[0]!.id = 'severity';
		bug.customFields[0]!.key = 'severity';
		const applied = applyConfigurationTemplates(project, [template, bug]);
		expect(applied.templateIds).toEqual(['standard', 'bug-template']);
		expect(applied.taskTypes.map((type) => type.id)).toEqual(['task', 'bug']);
		expect(applied.customFields?.map((field) => field.key)).toEqual(['story-points', 'severity']);
		expect(applied.workflow).toEqual(template.workflow);
	});

	it('shares a same-key custom field with every template task type that defines it', () => {
		const bug = structuredClone(template);
		bug.id = 'bug-template';
		bug.taskTypes = [{ id: 'bug', name: 'Bug', icon: 'bug', color: '#c9372c', active: true, template: '# Reproduce' }];
		const applied = applyConfigurationTemplates(project, [template, bug]);
		expect(applied.customFields).toEqual([
			expect.objectContaining({ key: 'story-points', taskTypeIds: ['task', 'bug'] }),
		]);
	});

	it('propagates customFieldRefs from template to project so new task modal shows unified metadata fields', () => {
		const withRefs = structuredClone(template);
		withRefs.customFieldRefs = [
			{ unifiedMetadataFieldId: 'field-estimate', taskTypeIds: ['task'] },
			{ unifiedMetadataFieldId: 'field-component', taskTypeIds: [] },
		];
		const applied = applyConfigurationTemplates(project, [withRefs]);
		expect(applied.customFieldRefs).toEqual([
			{ unifiedMetadataFieldId: 'field-estimate', taskTypeIds: ['task'] },
			{ unifiedMetadataFieldId: 'field-component', taskTypeIds: [] },
		]);
	});

	it('merges customFieldRefs across multiple enabled templates without duplicate unified field ids', () => {
		const primary = structuredClone(template);
		primary.customFieldRefs = [{ unifiedMetadataFieldId: 'field-a', taskTypeIds: ['task'] }];
		const secondary = structuredClone(template);
		secondary.id = 'bug-template';
		secondary.taskTypes = [{ id: 'bug', name: 'Bug', icon: 'bug', color: '#c9372c', active: true, template: '# Reproduce' }];
		secondary.customFieldRefs = [
			{ unifiedMetadataFieldId: 'field-a', taskTypeIds: ['bug'] },
			{ unifiedMetadataFieldId: 'field-b', taskTypeIds: ['bug'] },
		];
		const applied = applyConfigurationTemplates(project, [primary, secondary]);
		expect(applied.customFieldRefs).toEqual([
			{ unifiedMetadataFieldId: 'field-a', taskTypeIds: ['task', 'bug'] },
			{ unifiedMetadataFieldId: 'field-b', taskTypeIds: ['bug'] },
		]);
	});
});
