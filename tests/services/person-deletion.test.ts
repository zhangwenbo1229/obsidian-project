import { describe, expect, it } from 'vitest';
import { personDeletionBlockReason } from '../../src/services/person-deletion';

describe('person deletion protection', () => {
	it('blocks deleting the current user', () => {
		expect(personDeletionBlockReason('person-a', 'person-a', [])).toBe('不能删除当前用户，请先切换当前用户。');
	});

	it('blocks people referenced by project metadata, notes, or custom user fields', () => {
		const documents = [{
			metadata: {
				reporterId: 'reporter', assigneeId: 'assignee', custom: { reviewer: 'reviewer' },
			},
			notes: [{ authorId: 'author' }],
		}];
		for (const id of ['reporter', 'assignee', 'reviewer', 'author']) {
			expect(personDeletionBlockReason(id, 'current', documents)).toContain('仍被 1 个项目引用');
		}
	});

	it('allows an unused non-current person to be removed', () => {
		expect(personDeletionBlockReason('unused', 'current', [])).toBeNull();
	});
});
