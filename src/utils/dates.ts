const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN =
	/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

export function isIsoDate(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const match = DATE_PATTERN.exec(value);
	if (!match) return false;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

export function isIsoDateTimeWithOffset(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const match = DATE_TIME_PATTERN.exec(value);
	return Boolean(match && isIsoDate(match[1]) && !Number.isNaN(Date.parse(value)));
}

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

export function localDate(date = new Date()): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateTime(date = new Date()): string {
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? '+' : '-';
	const absoluteOffset = Math.abs(offsetMinutes);
	const offset = `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
	return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offset}`;
}

export function toDateTimeLocalInput(value: string | null): string {
	if (!value) return '';
	return value.includes('T') ? value.slice(0, 16) : `${value}T00:00`;
}

export function datePart(value: string | null): string {
	return value?.slice(0, 10) ?? '';
}

export function displayDateTime(value: string | null, fallback = ''): string {
	if (!value) return fallback;
	return value.includes('T') ? value.slice(0, 16).replace('T', ' ') : value;
}

export function fromDateTimeLocalInput(
	value: string,
	timezoneOffsetMinutes?: number,
): string | null {
	if (!value) return null;
	const offsetMinutes = timezoneOffsetMinutes ?? new Date(value).getTimezoneOffset();
	const sign = offsetMinutes <= 0 ? '+' : '-';
	const absoluteOffset = Math.abs(offsetMinutes);
	return `${value}:00${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}
