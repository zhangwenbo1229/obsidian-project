import { localDate } from '../utils/dates';

function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfCalendarWeek(cursor: Date): Date {
	const offset = (cursor.getDay() + 6) % 7;
	return addDays(cursor, -offset);
}

export function calendarWeekDates(cursor: Date): string[] {
	const start = startOfCalendarWeek(cursor);
	return Array.from({ length: 7 }, (_, index) => localDate(addDays(start, index)));
}

export function calendarMonthCells(cursor: Date): Array<string | null> {
	const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
	const leading = (first.getDay() + 6) % 7;
	const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
	return [
		...Array.from<null>({ length: leading }).fill(null),
		...Array.from({ length: days }, (_, index) => localDate(new Date(first.getFullYear(), first.getMonth(), index + 1))),
	];
}

export function moveCalendarCursor(cursor: Date, mode: 'month' | 'week', delta: number): Date {
	return mode === 'week'
		? addDays(cursor, delta * 7)
		: new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
}

export function calendarRangeTitle(cursor: Date, mode: 'month' | 'week'): string {
	if (mode === 'month') return `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`;
	const dates = calendarWeekDates(cursor);
	return `${dates[0]} 至 ${dates[6]}`;
}
