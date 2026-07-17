import type { CalendarItem } from './selectors';

export interface CalendarSpanLayout {
	item: CalendarItem;
	row: number;
	columnStart: number;
	columnSpan: number;
	lane: number;
}

type CalendarSpanCandidate = Omit<CalendarSpanLayout, 'lane'>;

export function layoutCalendarSpans(
	items: readonly CalendarItem[],
	dates: readonly (string | null)[],
): CalendarSpanLayout[] {
	const candidates: CalendarSpanCandidate[] = [];
	const rowCount = Math.ceil(dates.length / 7);
	for (const item of items) {
		for (let row = 0; row < rowCount; row += 1) {
			const week = dates.slice(row * 7, row * 7 + 7);
			const visibleColumns = week.flatMap((date, index) =>
				date && date >= item.start && date <= item.end ? [index + 1] : [],
			);
			if (visibleColumns.length === 0) continue;
			const columnStart = visibleColumns[0]!;
			candidates.push({
				item,
				row,
				columnStart,
				columnSpan: visibleColumns.at(-1)! - columnStart + 1,
			});
		}
	}

	candidates.sort((left, right) =>
		left.row - right.row
		|| left.columnStart - right.columnStart
		|| right.columnSpan - left.columnSpan
		|| left.item.key.localeCompare(right.item.key),
	);
	const laneEndsByRow = new Map<number, number[]>();
	return candidates.map((candidate) => {
		const laneEnds = laneEndsByRow.get(candidate.row) ?? [];
		let lane = laneEnds.findIndex((end) => end < candidate.columnStart);
		if (lane < 0) lane = laneEnds.length;
		laneEnds[lane] = candidate.columnStart + candidate.columnSpan - 1;
		laneEndsByRow.set(candidate.row, laneEnds);
		return { ...candidate, lane };
	});
}
