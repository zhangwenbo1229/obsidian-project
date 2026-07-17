import { describe, expect, it } from 'vitest';
import { groupTags, removeTagGroupAssignments, renameTagGroupAssignments } from '../../src/services/tag-group-service';

describe('tag groups', () => {
	it('keeps an explicit ungrouped section when no custom groups exist', () => {
		expect(groupTags(['alpha', 'beta'], [], {})).toEqual([
			{ groupId: null, name: '未分组', tags: ['alpha', 'beta'] },
		]);
	});
	it('groups root and nested tags without changing their stored paths', () => {
		expect(groupTags(
			['frontend', 'test/calendar', 'urgent'],
			[{ id: 'delivery', name: '交付', order: 1 }, { id: 'quality', name: '质量', order: 0 }],
			{ frontend: 'delivery', test: 'quality' },
		)).toEqual([
			{ groupId: 'quality', name: '质量', tags: ['test/calendar'] },
			{ groupId: 'delivery', name: '交付', tags: ['frontend'] },
			{ groupId: null, name: '未分组', tags: ['urgent'] },
		]);
	});

	it('renames and removes root tag group assignments', () => {
		expect(renameTagGroupAssignments({ work: 'g1', personal: 'g2' }, 'work', 'office')).toEqual({ office: 'g1', personal: 'g2' });
		expect(removeTagGroupAssignments({ office: 'g1', personal: 'g2' }, 'g1')).toEqual({ personal: 'g2' });
	});
});
