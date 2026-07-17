import { describe, expect, it } from 'vitest';
import { periodProgress } from '../../src/views/dashboard-modules/time-progress-model';

describe('dashboard period progress model', () => {
	it('calculates local week, month, and year progress within their calendar boundaries', () => {
		const value = periodProgress(new Date(2026, 6, 15, 12, 0, 0));
		expect(value.week.label).toBe('本周');
		expect(value.month.label).toBe('本月');
		expect(value.year.label).toBe('本年');
		expect(value.week.value).toBeGreaterThan(0.35);
		expect(value.week.value).toBeLessThan(0.36);
		expect(value.month.value).toBeGreaterThan(0.46);
		expect(value.month.value).toBeLessThan(0.48);
		expect(value.year.value).toBeGreaterThan(0.53);
		expect(value.year.value).toBeLessThan(0.54);
	});

	it('clamps every period to an inclusive zero-to-one range', () => {
		const snapshot = periodProgress(new Date(2026, 0, 1, 0, 0, 0));
		for (const part of [snapshot.week, snapshot.month, snapshot.year]) {
			expect(part.value).toBeGreaterThanOrEqual(0);
			expect(part.value).toBeLessThanOrEqual(1);
		}
	});
});
