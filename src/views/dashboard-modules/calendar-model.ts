export interface DashboardCalendarCell {
	isoDate: string;
	day: number | null;
	inCurrentMonth: boolean;
	isToday: boolean;
	holiday?: string;
	lunarLabel?: string;
}

export interface DashboardCalendarMonth {
	year: number;
	month: number;
	weekdays: string[];
	cells: DashboardCalendarCell[];
}

const FIXED_HOLIDAYS: Record<string, string> = {
	'01-01': '元旦',
	'05-01': '劳动节',
	'10-01': '国庆',
};

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function localIsoDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatChineseLunarDay(date: Date): string {
	try {
		return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
			month: 'short',
			day: 'numeric',
		}).format(date).replace(/^.*年/u, '').replace(/\s+/gu, '');
	} catch {
		return '';
	}
}

export function buildCalendarMonth(
	year: number,
	month: number,
	today: string,
	weekStartsOn: 0 | 1,
	showLunar: boolean,
): DashboardCalendarMonth {
	const firstDay = new Date(year, month, 1);
	const offset = (firstDay.getDay() - weekStartsOn + 7) % 7;
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const cellCount = Math.max(35, Math.ceil((offset + daysInMonth) / 7) * 7);
	const gridStart = new Date(year, month, 1 - offset);
	const cells = Array.from({ length: cellCount }, (_, index): DashboardCalendarCell => {
		const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
		const isoDate = localIsoDate(date);
		const inCurrentMonth = date.getMonth() === month;
		const holiday = inCurrentMonth ? FIXED_HOLIDAYS[isoDate.slice(5)] : undefined;
		const lunarLabel = inCurrentMonth && showLunar ? formatChineseLunarDay(date) : undefined;
		return {
			isoDate,
			day: inCurrentMonth ? date.getDate() : null,
			inCurrentMonth,
			isToday: isoDate === today,
			...(holiday ? { holiday } : {}),
			...(lunarLabel ? { lunarLabel } : {}),
		};
	});
	return {
		year,
		month,
		weekdays: weekStartsOn === 1
			? ['一', '二', '三', '四', '五', '六', '日']
			: ['日', '一', '二', '三', '四', '五', '六'],
		cells,
	};
}
