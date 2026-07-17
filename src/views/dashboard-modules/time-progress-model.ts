export interface PeriodProgressItem {
	label: string;
	value: number;
}

export interface PeriodProgressSnapshot {
	week: PeriodProgressItem;
	month: PeriodProgressItem;
	year: PeriodProgressItem;
}

function progressBetween(now: Date, start: Date, end: Date): number {
	const duration = end.getTime() - start.getTime();
	if (duration <= 0) return 0;
	return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / duration));
}

export function periodProgress(now: Date): PeriodProgressSnapshot {
	const weekOffset = (now.getDay() + 6) % 7;
	const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekOffset);
	const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const yearStart = new Date(now.getFullYear(), 0, 1);
	const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
	return {
		week: { label: '本周', value: progressBetween(now, weekStart, weekEnd) },
		month: { label: '本月', value: progressBetween(now, monthStart, monthEnd) },
		year: { label: '本年', value: progressBetween(now, yearStart, yearEnd) },
	};
}
