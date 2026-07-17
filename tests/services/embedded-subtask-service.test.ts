import { describe, expect, it } from 'vitest';
import { createEmbeddedSubtask, updateEmbeddedSubtask } from '../../src/services/embedded-subtask-service';

describe('embedded subtask service', () => {
	it('creates normalized metadata with stable timestamps', () => {
		const created = createEmbeddedSubtask({
			title: '  编写说明  ', priority: 'high', scheduledDate: null, startDate: null,
			dueDate: '2026-07-20T18:00:00+08:00', tags: [' release ', 'release'],
		}, new Date('2026-07-15T01:00:00Z'), () => '550e8400-e29b-41d4-a716-446655440000');
		expect(created).toMatchObject({
			id: '550e8400', title: '编写说明', completed: false,
			tags: ['release'], createdDate: '2026-07-15',
		});
	});

	it('rejects empty titles and keeps identity/creation time on update', () => {
		expect(() => createEmbeddedSubtask({ title: '', priority: 'medium', scheduledDate: null, startDate: null, dueDate: null, tags: [] })).toThrow('标题');
		const original = createEmbeddedSubtask({ title: 'A', priority: 'medium', scheduledDate: null, startDate: null, dueDate: null, tags: [] }, new Date('2026-07-15T01:00:00Z'), () => '550e8400-e29b-41d4-a716-446655440000');
		const updated = updateEmbeddedSubtask(original, { title: 'B', completed: true }, new Date('2026-07-16T01:00:00Z'));
		expect(updated).toMatchObject({ id: original.id, createdDate: original.createdDate, title: 'B', completed: true, doneDate: '2026-07-16' });
	});
});
