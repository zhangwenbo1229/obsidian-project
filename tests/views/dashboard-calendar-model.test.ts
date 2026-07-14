import { describe, expect, it } from 'vitest';
import { buildCalendarMonth, formatChineseLunarDay } from '../../src/views/dashboard-modules/calendar-model';

describe('dashboard calendar model', () => {
	it('builds a Monday-first month grid with adjacent-month padding', () => {
		const model = buildCalendarMonth(2026, 6, '2026-07-14', 1, false);
		expect(model.weekdays).toEqual(['一', '二', '三', '四', '五', '六', '日']);
		expect(model.cells).toHaveLength(35);
		expect(model.cells[0]).toMatchObject({ isoDate: '2026-06-29', inCurrentMonth: false });
		expect(model.cells[0]?.day).toBeNull();
		expect(model.cells[2]).toMatchObject({ isoDate: '2026-07-01', inCurrentMonth: true });
		expect(model.cells.find((cell) => cell.isoDate === '2026-07-14')).toMatchObject({ isToday: true });
	});

	it('marks fixed holidays and can include a compact lunar label', () => {
		const nationalDay = buildCalendarMonth(2026, 9, '2026-10-01', 1, true)
			.cells.find((cell) => cell.isoDate === '2026-10-01');
		expect(nationalDay?.holiday).toBe('国庆');
		expect(nationalDay?.lunarLabel).toBeTruthy();
		expect(formatChineseLunarDay(new Date(2026, 9, 1))).not.toContain('年');
	});

	it('supports Sunday as the first day of the week', () => {
		const model = buildCalendarMonth(2026, 6, '2026-07-14', 0, false);
		expect(model.weekdays).toEqual(['日', '一', '二', '三', '四', '五', '六']);
		expect(model.cells[0]?.isoDate).toBe('2026-06-28');
	});

	it('keeps at least five rows for compact four-week months', () => {
		expect(buildCalendarMonth(2021, 1, '2021-02-01', 1, false).cells).toHaveLength(35);
	});
});
