import { describe, expect, it } from 'vitest';
import {
	buildCheckInHeatmap,
	checkInHistoryFor,
	checkInSummary,
	normalizeCheckInHistory,
	normalizeCheckInHistories,
} from '../../src/views/dashboard-modules/check-in-model';

describe('dashboard check-in model', () => {
	it('normalizes local date keys and unique ISO timestamps', () => {
		expect(normalizeCheckInHistory({
			'2026-07-16': ['2026-07-16T08:00:00.000Z', '2026-07-16T08:00:00.000Z', 'bad'],
			bad: ['2026-07-16T09:00:00.000Z'],
		})).toEqual({ '2026-07-16': ['2026-07-16T08:00:00.000Z'] });
	});

	it('reports today progress, cumulative days and the current streak', () => {
		const history = normalizeCheckInHistory({
			'2026-07-13': ['2026-07-13T01:00:00.000Z'],
			'2026-07-14': ['2026-07-14T01:00:00.000Z'],
			'2026-07-15': ['2026-07-15T01:00:00.000Z'],
			'2026-07-16': ['2026-07-16T01:00:00.000Z', '2026-07-16T05:00:00.000Z'],
		});
		expect(checkInSummary(history, '2026-07-16', 3)).toEqual({
			todayCount: 2, dailyTarget: 3, completedToday: false, progress: 2 / 3,
			totalDays: 4, currentStreak: 4,
		});
	});

	it('converts shared check-in counts into heatmap intensity', () => {
		const model = buildCheckInHeatmap({
			'2026-07-15': ['a'],
			'2026-07-16': ['a', 'b', 'c'],
		}, 90, new Date(2026, 6, 16));
		expect(model.total).toBe(4);
		expect(model.cells.find((cell) => cell.date === '2026-07-16')).toMatchObject({ count: 3, level: 4 });
	});

	it('normalizes card-scoped histories while retaining a legacy fallback', () => {
		const settings = normalizeCheckInHistories({
			'check-a': { '2026-07-16': ['2026-07-16T01:00:00.000Z'] },
		});
		expect(settings['check-a']?.['2026-07-16']).toHaveLength(1);
		expect(checkInHistoryFor(settings, 'check-a')).toEqual(settings['check-a']);
		expect(checkInHistoryFor(settings, 'missing')).toEqual({});
	});
});
