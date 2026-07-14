import { describe, expect, it } from 'vitest';
import { restoreProjectFilter, serializeProjectFilter } from '../../src/views/saved-project-filters';

describe('saved project filters', () => {
	it('round-trips set-based filters through JSON-safe arrays', () => {
		const serialized = serializeProjectFilter({
			projectUid: 'project', keyword: 'login', statusIds: new Set(['todo']),
			statusCategories: new Set(), taskTypeIds: new Set(['bug']), reporterIds: new Set(),
			assigneeIds: new Set(['user']), tags: new Set(['mobile']), customFields: { severity: new Set(['critical']) },
			dueDateFrom: '2026-07-01', dueDateTo: '2026-07-31',
			hasIncompleteSubtasks: true,
		});
		expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
		const restored = restoreProjectFilter(serialized);
		expect(restored.statusIds).toEqual(new Set(['todo']));
		expect(restored.customFields?.severity).toEqual(new Set(['critical']));
		expect(restored.hasIncompleteSubtasks).toBe(true);
	});
});
