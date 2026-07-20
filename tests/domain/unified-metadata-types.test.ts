import { describe, expect, it } from 'vitest';
import type { UnifiedMetadataField, UnifiedFieldType, ProjectTemplateMetadataRef, PersonMetadataRef, TaskMetadataRef } from '../../src/domain/metadata-types';

const VALID_TYPES: UnifiedFieldType[] = [
	'text', 'multiline-text', 'number', 'boolean', 'date', 'datetime',
	'single-select', 'multi-select', 'user', 'task-reference',
];

describe('unified metadata types', () => {
	it('UnifiedMetadataField requires id, key, name, type, icon, color, required', () => {
		const field: UnifiedMetadataField = {
			id: 'field-1',
			key: 'severity',
			name: '严重程度',
			type: 'single-select',
			icon: 'alert-triangle',
			color: '#ff0000',
			required: true,
			defaultValue: null,
			options: [{ id: 'critical', name: '紧急' }],
		};
		expect(field.id).toBe('field-1');
		expect(field.key).toBe('severity');
		expect(field.name).toBe('严重程度');
		expect(field.type).toBe('single-select');
		expect(field.icon).toBe('alert-triangle');
		expect(field.color).toBe('#ff0000');
		expect(field.required).toBe(true);
		expect(field.defaultValue).toBeNull();
		expect(field.options).toEqual([{ id: 'critical', name: '紧急' }]);
	});

	it('UnifiedFieldType includes all 10 types from all three systems', () => {
		expect(VALID_TYPES).toHaveLength(10);
		expect(VALID_TYPES).toContain('text');
		expect(VALID_TYPES).toContain('multiline-text');
		expect(VALID_TYPES).toContain('number');
		expect(VALID_TYPES).toContain('boolean');
		expect(VALID_TYPES).toContain('date');
		expect(VALID_TYPES).toContain('datetime');
		expect(VALID_TYPES).toContain('single-select');
		expect(VALID_TYPES).toContain('multi-select');
		expect(VALID_TYPES).toContain('user');
		expect(VALID_TYPES).toContain('task-reference');
	});

	it('ProjectTemplateMetadataRef references unified field with taskTypeIds', () => {
		const ref: ProjectTemplateMetadataRef = {
			unifiedMetadataFieldId: 'field-1',
			taskTypeIds: ['task', 'bug'],
		};
		expect(ref.unifiedMetadataFieldId).toBe('field-1');
		expect(ref.taskTypeIds).toEqual(['task', 'bug']);
	});

	it('PersonMetadataRef references unified field with sourceProperty', () => {
		const ref: PersonMetadataRef = {
			unifiedMetadataFieldId: 'field-2',
			sourceProperty: 'email',
		};
		expect(ref.unifiedMetadataFieldId).toBe('field-2');
		expect(ref.sourceProperty).toBe('email');
	});

	it('TaskMetadataRef references unified field with showInTaskView and showInProjectCards', () => {
		const ref: TaskMetadataRef = {
			unifiedMetadataFieldId: 'field-3',
			showInTaskView: true,
			showInProjectCards: false,
		};
		expect(ref.unifiedMetadataFieldId).toBe('field-3');
		expect(ref.showInTaskView).toBe(true);
		expect(ref.showInProjectCards).toBe(false);
	});
});