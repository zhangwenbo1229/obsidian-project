import { describe, expect, it } from 'vitest';
import { buildDateSnapshot, daysUntilDate } from '../../src/views/dashboard-modules/date-model';

describe('dashboard date model', () => {
	it('builds current local date details with optional lunar, holiday, weekday and time', () => {
		const date = new Date(2026, 9, 1, 8, 9, 7);
		const full = buildDateSnapshot(date, {
			showLunar: true, showHoliday: true, showTime: true, showWeekday: true, showSeconds: true,
		});
		expect(full.isoDate).toBe('2026-10-01');
		expect(full.holiday).toBe('国庆');
		expect(full.weekday).toBeTruthy();
		expect(full.time).toBe('08:09:07');
		expect(full.lunar).toBeTruthy();
		const minimal = buildDateSnapshot(date, {
			showLunar: false, showHoliday: false, showTime: false, showWeekday: false, showSeconds: false,
		});
		expect(minimal).toMatchObject({ lunar: '', holiday: '', weekday: '', time: '' });
	});

	it('calculates countdowns from local calendar days', () => {
		const now = new Date(2026, 6, 14, 23, 59);
		expect(daysUntilDate('2026-07-15', now, false)).toBe(1);
		expect(daysUntilDate('2026-07-15', now, true)).toBe(2);
		expect(daysUntilDate('2026-07-14', now, false)).toBe(0);
		expect(daysUntilDate('2026-07-13', now, false)).toBe(-1);
		expect(daysUntilDate('invalid', now, false)).toBeNull();
	});
});
