import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeProjectViewDisplay } from '../../src/views/task-display-settings';
import { reorderTaskDisplayFields } from '../../src/views/display-field-order';

const orderUrl = new URL('../../src/views/display-field-order.ts', import.meta.url);

describe('task display field order', () => {
	it('includes links, relationships, and Markdown subtasks without losing configured order', () => {
		const normalized = normalizeProjectViewDisplay({
			list: ['subtasks', 'title', 'relations', 'links'] as never,
		});
		expect(normalized.list as string[]).toEqual(['subtasks', 'title', 'relations', 'links']);
	});

	it('reorders one enabled field relative to another', () => {
		expect(existsSync(orderUrl)).toBe(true);
		expect(reorderTaskDisplayFields(['key', 'title', 'priority'], 'priority', 'title'))
			.toEqual(['key', 'priority', 'title']);
	});
});
