import type { DashboardCardKind } from '../domain/types';
import { normalizeCheckInHistories, type CheckInHistories } from './dashboard-modules/check-in-model';

export interface PersonalDashboardSettings {
	enabledCardKinds: DashboardCardKind[];
	openPersonalDashboardOnStartup: boolean;
	weatherCredentials: PersonalDashboardWeatherCredentials;
	fileOpenCounts: Record<string, number>;
	checkInHistories: CheckInHistories;
}

export interface PersonalDashboardWeatherCredentials {
	qweatherApiKey: string;
	qweatherApiHost: string;
	openWeatherMapApiKey: string;
}

export const ALL_DASHBOARD_CARD_KINDS: DashboardCardKind[] = [
	'number',
	'percentage',
	'task-list',
	'weather',
	'calendar',
	'date',
	'todo',
	'note-stats',
	'recent-files',
	'news',
	'directory',
	'text',
	'chart',
	'countdown',
	'progress',
	'check-in',
	'heatmap',
	'iframe',
	'calculator',
	'ip',
];

function normalizedHttpsOrigin(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return '';
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' ? url.origin : '';
	} catch {
		return '';
	}
}

export function normalizePersonalDashboardSettings(value?: unknown): PersonalDashboardSettings {
	const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
	const weather = source.weatherCredentials && typeof source.weatherCredentials === 'object'
		? source.weatherCredentials as Record<string, unknown>
		: {};
	const supported = new Set<DashboardCardKind>(ALL_DASHBOARD_CARD_KINDS);
	const counts = source.fileOpenCounts && typeof source.fileOpenCounts === 'object'
		? source.fileOpenCounts as Record<string, unknown>
		: {};
	return {
		openPersonalDashboardOnStartup: source.openPersonalDashboardOnStartup === true,
		enabledCardKinds: Array.isArray(source.enabledCardKinds)
			? [...new Set([...source.enabledCardKinds.filter((kind): kind is DashboardCardKind =>
				typeof kind === 'string' && supported.has(kind as DashboardCardKind),
			), ...ALL_DASHBOARD_CARD_KINDS])]
			: [...ALL_DASHBOARD_CARD_KINDS],
		weatherCredentials: {
			qweatherApiKey: typeof weather.qweatherApiKey === 'string' ? weather.qweatherApiKey.trim() : '',
			qweatherApiHost: normalizedHttpsOrigin(weather.qweatherApiHost),
			openWeatherMapApiKey: typeof weather.openWeatherMapApiKey === 'string'
				? weather.openWeatherMapApiKey.trim()
				: '',
		},
		fileOpenCounts: Object.fromEntries(Object.entries(counts).flatMap(([path, count]) => {
			const normalizedPath = path.trim();
			if (!normalizedPath || typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return [];
			return [[normalizedPath, Math.min(1_000_000, Math.floor(count))]];
		})),
		checkInHistories: normalizeCheckInHistories(source.checkInHistories),
	};
}
