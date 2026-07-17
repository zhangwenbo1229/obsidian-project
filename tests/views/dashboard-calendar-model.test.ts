import { describe, expect, it } from 'vitest';
import {
	buildCalendarMonth,
	formatChineseLunarDay,
	getChineseCalendarMetadata,
	getSolarTerm,
} from '../../src/views/dashboard-modules/calendar-model';

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
		const nationalDay = buildCalendarMonth(2026, 9, '2026-10-01', 1, true, true)
			.cells.find((cell) => cell.isoDate === '2026-10-01');
		expect(nationalDay?.holiday).toBe('国庆');
		expect(nationalDay?.lunarLabel).toBeTruthy();
		expect(formatChineseLunarDay(new Date(2026, 9, 1))).not.toContain('年');
		expect(formatChineseLunarDay(new Date(2026, 1, 17))).toBe('初一');
		expect(nationalDay?.lunarLabel).not.toMatch(/月/u);
	});

	it('uses canonical Chinese lunar day names without a lunar month prefix', () => {
		const labels = buildCalendarMonth(2026, 1, '2026-02-17', 1, true, false).cells
			.filter((cell) => cell.inCurrentMonth)
			.map((cell) => cell.lunarLabel);
		expect(labels).toContain('初一');
		expect(labels.some((label) => label?.includes('十一'))).toBe(true);
		expect(labels.every((label) => !label?.includes('月'))).toBe(true);
	});

	it('controls lunar and holiday annotations independently', () => {
		const hidden = buildCalendarMonth(2026, 9, '2026-10-01', 1, false, false)
			.cells.find((cell) => cell.isoDate === '2026-10-01');
		expect(hidden?.holiday).toBeUndefined();
		expect(hidden?.lunarLabel).toBeUndefined();
		const holidayOnly = buildCalendarMonth(2026, 9, '2026-10-01', 1, false, true)
			.cells.find((cell) => cell.isoDate === '2026-10-01');
		expect(holidayOnly?.holiday).toBe('国庆');
		expect(holidayOnly?.lunarLabel).toBeUndefined();
	});

	it('supports Sunday as the first day of the week', () => {
		const model = buildCalendarMonth(2026, 6, '2026-07-14', 0, false);
		expect(model.weekdays).toEqual(['日', '一', '二', '三', '四', '五', '六']);
		expect(model.cells[0]?.isoDate).toBe('2026-06-28');
	});

	it('keeps at least five rows for compact four-week months', () => {
		expect(buildCalendarMonth(2021, 1, '2021-02-01', 1, false).cells).toHaveLength(35);
	});

	it('provides lunar year, month, day and traditional festivals', () => {
		const springFestival = getChineseCalendarMetadata(new Date(2026, 1, 17));
		expect(springFestival).toMatchObject({
			lunarMonth: '正月', lunarDay: '初一', ganzhiYear: '丙午年',
		});
		expect(springFestival.lunarFestivals).toContain('春节');
		const midAutumn = getChineseCalendarMetadata(new Date(2026, 8, 25));
		expect(midAutumn.lunarFestivals).toContain('中秋节');
		expect(getChineseCalendarMetadata(new Date(2026, 1, 16)).lunarFestivals).toContain('除夕');
	});

	it('combines Gregorian festivals, lunar festivals and solar terms', () => {
		expect(getSolarTerm(new Date(2026, 3, 5))).toBe('清明');
		const nationalDay = buildCalendarMonth(2026, 9, '2026-10-01', 1, true, true)
			.cells.find((cell) => cell.isoDate === '2026-10-01');
		expect(nationalDay?.festivals).toContain('国庆节');
		expect(nationalDay?.annotation).toBe('国庆节');
	});

	it('marks today and weekends independently from annotations', () => {
		const model = buildCalendarMonth(2026, 6, '2026-07-18', 1, true, true);
		expect(model.cells.find((cell) => cell.isoDate === '2026-07-18')).toMatchObject({
			isToday: true, isWeekend: true,
		});
		expect(model.cells.find((cell) => cell.isoDate === '2026-07-20')?.isWeekend).toBe(false);
	});
});
