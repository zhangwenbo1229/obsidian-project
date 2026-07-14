import { describe, expect, it } from 'vitest';
import { mapConcurrent } from '../../src/utils/async-pool';

describe('bounded async pool', () => {
	it('preserves order while limiting concurrent work', async () => {
		let active = 0;
		let maximum = 0;
		const result = await mapConcurrent([3, 1, 2, 4], 2, async (value) => {
			active += 1;
			maximum = Math.max(maximum, active);
			await Promise.resolve();
			active -= 1;
			return value * 2;
		});
		expect(result).toEqual([6, 2, 4, 8]);
		expect(maximum).toBe(2);
	});
});
