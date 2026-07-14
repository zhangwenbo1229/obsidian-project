import type { DateDashboardModuleConfig } from '../../domain/types';
import { formatChineseLunarDay } from './calendar-model';

const FIXED_HOLIDAYS: Record<string, string> = {
	'01-01': '元旦',
	'05-01': '劳动节',
	'10-01': '国庆',
};

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

export function localIsoDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildDateSnapshot(date: Date, config: DateDashboardModuleConfig) {
	const isoDate = localIsoDate(date);
	return {
		isoDate,
		dateText: new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date),
		weekday: config.showWeekday ? new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(date) : '',
		time: config.showTime
			? `${pad(date.getHours())}:${pad(date.getMinutes())}${config.showSeconds ? `:${pad(date.getSeconds())}` : ''}`
			: '',
		lunar: config.showLunar ? formatChineseLunarDay(date) : '',
		holiday: config.showHoliday ? FIXED_HOLIDAYS[isoDate.slice(5)] ?? '' : '',
	};
}

export function daysUntilDate(targetDate: string, now: Date, includeToday: boolean): number | null {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(targetDate)) return null;
	const [year, month, day] = targetDate.split('-').map(Number);
	if (year === undefined || month === undefined || day === undefined) return null;
	const target = new Date(year, month - 1, day);
	if (target.getFullYear() !== year || target.getMonth() !== month - 1 || target.getDate() !== day) return null;
	const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
	const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
	const difference = Math.round((targetUtc - todayUtc) / 86_400_000);
	return includeToday && difference > 0 ? difference + 1 : difference;
}
