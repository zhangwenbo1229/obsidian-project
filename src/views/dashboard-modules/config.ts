import type {
	CalendarDashboardModuleConfig,
	DashboardModuleConfig,
	DashboardModuleKind,
	DirectoryDashboardModuleConfig,
	NewsDashboardModuleConfig,
	NoteStatsDashboardModuleConfig,
	RecentFilesDashboardModuleConfig,
	WeatherDashboardModuleConfig,
	TextDashboardModuleConfig,
	ChartDashboardModuleConfig,
} from '../../domain/types';

const WEATHER_PROVIDERS = new Set(['open-meteo', 'qweather', 'openweathermap']);

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
	{ kind: 'text', label: '文本', icon: 'notebook-pen', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'chart', label: '图表', icon: 'chart-column', defaultSize: { columns: 2, rows: 3 } },
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

function normalizedDirectoryPaths(value: unknown): string[] {
	return normalizedPaths(value)
		.map((item) => item.replace(/^\/+|\/+$/gu, ''))
		.filter(Boolean);
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

function normalizedHttpsOrigin(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return '';
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' ? url.origin : '';
	} catch {
		return '';
	}
}

export function normalizeDashboardModuleConfig(kind: DashboardModuleKind, value: unknown): DashboardModuleConfig {
	const source = objectValue(value);
	if (kind === 'weather') return {
		networkEnabled: source.networkEnabled === true,
		provider: typeof source.provider === 'string' && WEATHER_PROVIDERS.has(source.provider)
			? source.provider as WeatherDashboardModuleConfig['provider']
			: 'open-meteo',
		apiKey: typeof source.apiKey === 'string' ? source.apiKey.trim() : '',
		apiHost: normalizedHttpsOrigin(source.apiHost),
		locationName: typeof source.locationName === 'string' && source.locationName.trim() ? source.locationName.trim() : '上海',
		latitude: boundedNumber(source.latitude, 31.2304, -90, 90),
		longitude: boundedNumber(source.longitude, 121.4737, -180, 180),
		forecastDays: boundedNumber(source.forecastDays, 3, 1, 7),
		refreshMinutes: boundedNumber(source.refreshMinutes, 30, 10, 360),
	} satisfies WeatherDashboardModuleConfig;
	if (kind === 'calendar') return {
		showLunar: source.showLunar !== false,
		weekStartsOn: source.weekStartsOn === 0 ? 0 : 1,
	} satisfies CalendarDashboardModuleConfig;
	if (kind === 'note-stats') return {
		rootPath: typeof source.rootPath === 'string' ? source.rootPath.trim().replace(/^\/+|\/+$/gu, '') : '',
		excludePaths: normalizedDirectoryPaths(source.excludePaths),
		topFolderLimit: boundedNumber(source.topFolderLimit, 5, 1, 12),
	} satisfies NoteStatsDashboardModuleConfig;
	if (kind === 'recent-files') return {
		rootPath: typeof source.rootPath === 'string' ? source.rootPath.trim().replace(/^\/+|\/+$/gu, '') : '',
		excludePaths: normalizedDirectoryPaths(source.excludePaths),
		limit: boundedNumber(source.limit, 8, 3, 30),
	} satisfies RecentFilesDashboardModuleConfig;
	if (kind === 'news') return {
		networkEnabled: source.networkEnabled === true,
		feedUrls: normalizedFeedUrls(source.feedUrls),
		pageSize: boundedNumber(source.pageSize, 5, 3, 12),
		refreshMinutes: boundedNumber(source.refreshMinutes, 30, 10, 360),
	} satisfies NewsDashboardModuleConfig;
	if (kind === 'directory') return {
		rootPaths: normalizedPaths(source.rootPaths),
		maxDepth: boundedNumber(source.maxDepth, 4, 1, 8),
	} satisfies DirectoryDashboardModuleConfig;
	if (kind === 'text') return {
		markdown: typeof source.markdown === 'string' ? source.markdown : '## 文本卡片\n\n在设置中输入 Markdown 内容。',
	} satisfies TextDashboardModuleConfig;
	return {
		chartType: source.chartType === 'bar' || source.chartType === 'pie' ? source.chartType : 'line',
		csv: typeof source.csv === 'string' && source.csv.trim()
			? source.csv.trim()
			: '分类,计划,实际\n一月,10,8\n二月,12,11\n三月,9,13',
	} satisfies ChartDashboardModuleConfig;
}
