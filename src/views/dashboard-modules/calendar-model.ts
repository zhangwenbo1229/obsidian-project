export interface DashboardCalendarCell {
	isoDate: string;
	day: number | null;
	inCurrentMonth: boolean;
	isToday: boolean;
	isWeekend: boolean;
	holiday?: string;
	lunarLabel?: string;
	lunarMonth?: string;
	lunarDay?: string;
	ganzhiYear?: string;
	festivals?: string[];
	solarTerm?: string;
	annotation?: string;
}

export interface DashboardCalendarMonth {
	year: number;
	month: number;
	weekdays: string[];
	cells: DashboardCalendarCell[];
}

export interface ChineseCalendarMetadata {
	lunarMonth: string;
	lunarDay: string;
	ganzhiYear: string;
	lunarFestivals: string[];
}

const GREGORIAN_FESTIVALS: Record<string, string> = {
	'01-01': '元旦', '02-14': '情人节', '03-08': '妇女节', '05-01': '劳动节',
	'05-04': '青年节', '06-01': '儿童节', '09-10': '教师节', '10-01': '国庆节', '12-25': '圣诞节',
};
const LUNAR_FESTIVALS: Record<string, string> = {
	'正月-初一': '春节', '正月-十五': '元宵节', '五月-初五': '端午节',
	'二月-初二': '龙抬头', '七月-初七': '七夕', '七月-十五': '中元节',
	'八月-十五': '中秋节', '九月-初九': '重阳节', '腊月-初八': '腊八节', '腊月-廿三': '小年',
};
const SOLAR_TERM_NAMES = [
	'小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
	'小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];
const SOLAR_TERM_MINUTES = [
	0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
	263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
];
const HEAVENLY_STEMS = '甲乙丙丁戊己庚辛壬癸';
const EARTHLY_BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

function pad(value: number): string { return String(value).padStart(2, '0'); }
function localIsoDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function lunarDayName(value: string): string {
	const day = Number(value);
	if (!Number.isFinite(day) || day < 1 || day > 30) return value;
	const digits = '一二三四五六七八九十';
	if (day <= 10) return `初${digits[day - 1]}`;
	if (day < 20) return `十${digits[day - 11]}`;
	if (day === 20) return '二十';
	if (day < 30) return `廿${digits[day - 21]}`;
	return '三十';
}

function ganzhiYear(year: number): string {
	return `${HEAVENLY_STEMS[(year - 4) % 10]}${EARTHLY_BRANCHES[(year - 4) % 12]}年`;
}

export function getChineseCalendarMetadata(date: Date): ChineseCalendarMetadata {
	try {
		const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
			year: 'numeric', month: 'long', day: 'numeric',
		}).formatToParts(date);
		const lunarMonth = (parts.find((part) => part.type === 'month')?.value ?? '').replace(/月$/u, '月');
		const rawDay = parts.find((part) => part.type === 'day')?.value ?? '';
		const relatedYear = Number(parts.find((part) => String(part.type) === 'relatedYear')?.value ?? date.getFullYear());
		const lunarDay = lunarDayName(rawDay);
		const festival = LUNAR_FESTIVALS[`${lunarMonth}-${lunarDay}`];
		const tomorrowParts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
			year: 'numeric', month: 'long', day: 'numeric',
		}).formatToParts(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
		const tomorrowMonth = tomorrowParts.find((part) => part.type === 'month')?.value ?? '';
		const tomorrowDay = Number(tomorrowParts.find((part) => part.type === 'day')?.value ?? 0);
		const isNewYearsEve = tomorrowMonth === '正月' && tomorrowDay === 1;
		return {
			lunarMonth,
			lunarDay,
			ganzhiYear: ganzhiYear(relatedYear),
			lunarFestivals: [festival, isNewYearsEve ? '除夕' : undefined].filter((value): value is string => Boolean(value)),
		};
	} catch {
		return { lunarMonth: '', lunarDay: '', ganzhiYear: '', lunarFestivals: [] };
	}
}

export function formatChineseLunarDay(date: Date): string {
	const metadata = getChineseCalendarMetadata(date);
	return metadata.lunarDay;
}

export function getSolarTerm(date: Date): string | undefined {
	const year = date.getFullYear();
	if (year < 1900 || year > 2100) return undefined;
	for (const [index, minutes] of SOLAR_TERM_MINUTES.entries()) {
		const timestamp = Date.UTC(1900, 0, 6, 2, 5) + 31_556_925_974.7 * (year - 1900) + minutes * 60_000;
		const termDate = new Date(timestamp);
		if (termDate.getUTCMonth() === date.getMonth() && termDate.getUTCDate() === date.getDate()) {
			return SOLAR_TERM_NAMES[index];
		}
	}
	return undefined;
}

export function buildCalendarMonth(
	year: number,
	month: number,
	today: string,
	weekStartsOn: 0 | 1,
	showLunar: boolean,
	showHolidays = true,
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
		const lunar = inCurrentMonth && (showLunar || showHolidays) ? getChineseCalendarMetadata(date) : undefined;
		const solarTerm = inCurrentMonth && showHolidays ? getSolarTerm(date) : undefined;
		const gregorianFestival = inCurrentMonth && showHolidays ? GREGORIAN_FESTIVALS[isoDate.slice(5)] : undefined;
		const festivals = [gregorianFestival, ...(lunar?.lunarFestivals ?? []), solarTerm].filter((value): value is string => Boolean(value));
		const lunarLabel = inCurrentMonth && showLunar ? lunar?.lunarDay : undefined;
		return {
			isoDate,
			day: inCurrentMonth ? date.getDate() : null,
			inCurrentMonth,
			isToday: isoDate === today,
			isWeekend: date.getDay() === 0 || date.getDay() === 6,
			...(gregorianFestival ? { holiday: gregorianFestival.replace(/节$/u, '') } : {}),
			...(lunarLabel ? { lunarLabel, lunarMonth: lunar?.lunarMonth, lunarDay: lunar?.lunarDay, ganzhiYear: lunar?.ganzhiYear } : {}),
			...(festivals.length > 0 ? { festivals, annotation: festivals[0] } : {}),
			...(solarTerm ? { solarTerm } : {}),
		};
	});
	return {
		year,
		month,
		weekdays: weekStartsOn === 1 ? ['一', '二', '三', '四', '五', '六', '日'] : ['日', '一', '二', '三', '四', '五', '六'],
		cells,
	};
}
