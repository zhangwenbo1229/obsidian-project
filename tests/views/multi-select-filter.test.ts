import { describe, expect, it } from 'vitest';
import { toggleMultiValue } from '../../src/views/multi-select-filter';

describe('checkbox multi-select filters', () => {
	it('adds and removes values without mutating the input set', () => {
		const selected = new Set(['a']);
		expect(toggleMultiValue(selected, 'b', true)).toEqual(new Set(['a', 'b']));
		expect(toggleMultiValue(selected, 'a', false)).toEqual(new Set());
		expect(selected).toEqual(new Set(['a']));
	});
});
