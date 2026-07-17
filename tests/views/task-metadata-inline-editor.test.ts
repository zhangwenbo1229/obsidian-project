import { describe, expect, it } from 'vitest';
import type { EmbeddedSubtask } from '../../src/domain/types';
import type { TaskMetadataDisplayField } from '../../src/settings/task-metadata-settings';
import { applyTaskMetadataEditorValue, isInlineEditableTaskMetadata } from '../../src/views/task-metadata-inline-editor';
const task: EmbeddedSubtask = {
	id: 'task0001', title: '任务', completed: false, priority: 'medium', tags: ['alpha'],
	scheduledDate: '2026-07-15', startDate: null, dueDate: null,
	createdDate: '2026-07-14', doneDate: null, cancelledDate: null,
};

describe('task metadata inline editing', () => {
	it('edits only the four configured task dates', () => {
		for (const field of ['scheduledDate', 'dueDate', 'startDate', 'doneDate'] as TaskMetadataDisplayField[]) {
			expect(isInlineEditableTaskMetadata(field)).toBe(true);
		}
		for (const field of ['priority', 'tags', 'createdDate', 'cancelledDate', 'id', 'project']) {
			expect(isInlineEditableTaskMetadata(field)).toBe(false);
		}
	});

	it('normalizes empty and populated date values', () => {
		expect(applyTaskMetadataEditorValue(task, 'scheduledDate', '')).toMatchObject({ scheduledDate: null });
		expect(applyTaskMetadataEditorValue(task, 'doneDate', '2026-07-16')).toMatchObject({ doneDate: '2026-07-16' });
	});
});
