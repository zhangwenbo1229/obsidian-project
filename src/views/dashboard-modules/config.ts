import type {
	CalendarDashboardModuleConfig,
	DashboardModuleConfig,
	DashboardModuleKind,
	DirectoryDashboardModuleConfig,
	NewsDashboardModuleConfig,
	NoteStatsDashboardModuleConfig,
	RecentFilesDashboardModuleConfig,
	WeatherDashboardModuleConfig,
} from '../../domain/types';

export const DASHBOARD_MODULE_CATALOG: Array<{
	kind: DashboardModuleKind;
	label: string;
	icon: string;
	defaultSize: { columns: number; rows: number };
}> = [
	{ kind: 'weather', label: '天气', icon: 'cloud-sun', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'calendar', label: '日历', icon: 'calendar-days', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'note-stats', label: '笔记统计', icon: 'chart-no-axes-column-increasing', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'recent-files', label: '最近文件', icon: 'history', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'news', label: '资讯', icon: 'newspaper', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'directory', label: '目录', icon: 'folder-tree', defaultSize: { columns: 2, rows: 3 } },
];

export function isDashboardModuleKind(value: string): value is DashboardModuleKind {
	return DASHBOARD_MODULE_CATALOG.some((item) => item.kind === value);
}

function objectValue(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
	const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
	return Math.min(max, Math.max(min, number));
}

function normalizedPaths(value: unknown): string[] {
	return Array.isArray(value)
		? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
		: [];
}

function normalizedFeedUrls(value: unknown): string[] {
	return normalizedPaths(value).filter((item) => {
		try {
			const protocol = new URL(item).protocol;
			return protocol === 'https:' || protocol === 'http:';
		} catch {
			return false;
		}
	});
}

export function normalizeDashboardModuleConfig(kind: DashboardModuleKind, value: unknown): DashboardModuleConfig {
	const source = objectValue(value);
	if (kind === 'weather') return {
		networkEnabled: source.networkEnabled === true,
		locationName: typeof source.locationName === 'string' && source.locationName.trim() ? source.locationName.trim() : '上海',
		latitude: boundedNumber(source.latitude, 31.2304, -90, 90),
		longitude: boundedNumber(source.longitude, 121.4737, -180, 180),
		refreshMinutes: boundedNumber(source.refreshMinutes, 30, 10, 360),
	} satisfies WeatherDashboardModuleConfig;
	if (kind === 'calendar') return {
		showLunar: source.showLunar !== false,
		weekStartsOn: source.weekStartsOn === 0 ? 0 : 1,
	} satisfies CalendarDashboardModuleConfig;
	if (kind === 'note-stats') return {
		rootPath: typeof source.rootPath === 'string' ? source.rootPath.trim().replace(/^\/+|\/+$/gu, '') : '',
		topFolderLimit: boundedNumber(source.topFolderLimit, 5, 1, 12),
	} satisfies NoteStatsDashboardModuleConfig;
	if (kind === 'recent-files') return {
		rootPath: typeof source.rootPath === 'string' ? source.rootPath.trim().replace(/^\/+|\/+$/gu, '') : '',
		limit: boundedNumber(source.limit, 8, 3, 30),
	} satisfies RecentFilesDashboardModuleConfig;
	if (kind === 'news') return {
		networkEnabled: source.networkEnabled === true,
		feedUrls: normalizedFeedUrls(source.feedUrls),
		pageSize: boundedNumber(source.pageSize, 5, 3, 12),
		refreshMinutes: boundedNumber(source.refreshMinutes, 30, 10, 360),
	} satisfies NewsDashboardModuleConfig;
	return {
		rootPaths: normalizedPaths(source.rootPaths),
		maxDepth: boundedNumber(source.maxDepth, 4, 1, 8),
	} satisfies DirectoryDashboardModuleConfig;
}
