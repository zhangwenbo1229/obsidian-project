import { describe, expect, it } from 'vitest';
import { availableTagGroups, filterTagSuggestions, groupIdForTag } from '../../src/modals/tag-picker-model';

const groups = [
	{ id: 'product', name: '产品', order: 0 },
	{ id: 'team', name: '团队', order: 1 },
];
const assignments = { feature: 'product', engineering: 'team' };

describe('tag picker model', () => {
	it('offers ungrouped as the default group', () => {
		expect(availableTagGroups(groups)[0]).toEqual({ id: null, name: '未分组' });
	});

	it('filters suggestions within the selected group and excludes selected tags', () => {
		expect(filterTagSuggestions(
			['feature/mobile', 'feature/web', 'engineering/frontend', 'misc'], groups, assignments,
			'product', 'WEB', ['feature/mobile'],
		)).toEqual(['feature/web']);
	});

	it('resolves hierarchical tags by root assignment', () => {
		expect(groupIdForTag('engineering/frontend', groups, assignments)).toBe('team');
		expect(groupIdForTag('unknown/path', groups, assignments)).toBeNull();
	});
});
