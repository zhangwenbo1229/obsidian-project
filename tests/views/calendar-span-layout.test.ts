import { describe, expect, it } from 'vitest';
import { layoutCalendarSpans } from '../../src/views/calendar-span-layout';
import type { CalendarItem } from '../../src/views/selectors';

const item = (uid: string, start: string, end: string): CalendarItem => ({ uid, key: uid, title: uid, start, end });

describe('calendar span layout', () => {
	it('lays out a single-day item in one calendar column', () => {
		const dates = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19'];
		expect(layoutCalendarSpans([item('one', '2026-07-15', '2026-07-15')], dates)
			.map(({ item: value, ...span }) => ({ uid: value.uid, ...span }))).toEqual([
			{ uid: 'one', row: 0, columnStart: 3, columnSpan: 1, lane: 0 },
		]);
	});

	it('spans the visible columns of a same-week date range', () => {
		const dates = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19'];
		expect(layoutCalendarSpans([item('range', '2026-07-14', '2026-07-18')], dates)
			.map(({ item: value, ...span }) => ({ uid: value.uid, ...span }))).toEqual([
			{ uid: 'range', row: 0, columnStart: 2, columnSpan: 5, lane: 0 },
		]);
	});

	it('splits a cross-week range and clips it to month padding', () => {
		const dates = [
			null, null, '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
			'2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12',
		];
		expect(layoutCalendarSpans([item('range', '2026-06-29', '2026-07-08')], dates)
			.map(({ item: value, ...span }) => ({ uid: value.uid, ...span }))).toEqual([
			{ uid: 'range', row: 0, columnStart: 3, columnSpan: 5, lane: 0 },
			{ uid: 'range', row: 1, columnStart: 1, columnSpan: 3, lane: 0 },
		]);
	});

	it('assigns overlapping spans to separate stable lanes', () => {
		const dates = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19'];
		const spans = layoutCalendarSpans([
			item('first', '2026-07-13', '2026-07-16'),
			item('second', '2026-07-15', '2026-07-18'),
			item('third', '2026-07-19', '2026-07-19'),
		], dates);
		expect(spans.map((span) => [span.item.uid, span.lane])).toEqual([
			['first', 0], ['second', 1], ['third', 0],
		]);
	});
});
