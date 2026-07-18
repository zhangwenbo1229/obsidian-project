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
	DateDashboardModuleConfig,
	TodoDashboardModuleConfig,
	CountdownDashboardModuleConfig,
	CheckInDashboardModuleConfig,
	HeatmapDashboardModuleConfig,
	IframeDashboardModuleConfig,
	TimeProgressDashboardModuleConfig,
	CalculatorDashboardModuleConfig,
	IpDashboardModuleConfig,
} from '../../domain/types';

const WEATHER_PROVIDERS = new Set(['open-meteo', 'qweather', 'openweathermap']);
const NOTE_STATS_FIELDS = new Set(['noteCount', 'characterCount', 'folderCount', 'totalSize', 'topFolders']);

export const DASHBOARD_MODULE_CATALOG: Array<{
	kind: DashboardModuleKind;
	label: string;
	icon: string;
	defaultSize: { columns: number; rows: number };
}> = [
	{ kind: 'weather', label: '天气', icon: 'cloud-sun', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'calendar', label: '日历', icon: 'calendar-days', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'date', label: '日期', icon: 'calendar-heart', defaultSize: { columns: 1, rows: 2 } },
	{ kind: 'todo', label: '待办', icon: 'list-todo', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'note-stats', label: '笔记统计', icon: 'chart-no-axes-column-increasing', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'recent-files', label: '文件', icon: 'files', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'news', label: '资讯', icon: 'newspaper', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'directory', label: '目录', icon: 'folder-tree', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'text', label: '文本', icon: 'notebook-pen', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'chart', label: '图表', icon: 'chart-column', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'countdown', label: '计时', icon: 'hourglass', defaultSize: { columns: 1, rows: 2 } },
	{ kind: 'progress', label: '进度', icon: 'chart-no-axes-gantt', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'check-in', label: '打卡', icon: 'badge-check', defaultSize: { columns: 2, rows: 2 } },
	{ kind: 'heatmap', label: '热力图', icon: 'layout-grid', defaultSize: { columns: 3, rows: 2 } },
	{ kind: 'iframe', label: '网页', icon: 'panels-top-left', defaultSize: { columns: 3, rows: 3 } },
	{ kind: 'calculator', label: '计算器', icon: 'calculator', defaultSize: { columns: 2, rows: 3 } },
	{ kind: 'ip', label: '公网 IP', icon: 'globe', defaultSize: { columns: 1, rows: 1 } },
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

function normalizedExtensions(value: unknown): string[] {
	const extensions = [...new Set(normalizedPaths(value).map((extension) => extension.replace(/^\./u, '').toLowerCase()).filter(Boolean))];
	return extensions.length > 0 ? extensions : ['md'];
}

function normalizedColor(value: unknown, fallback: string): string {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value.trim()) ? value.trim().toLowerCase() : fallback;
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

function normalizedWebUrl(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return '';
	try {
		const url = new URL(value.trim());
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
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
		locationName: typeof source.locationName === 'string' && source.locationName.trim() ? source.locationName.trim() : '上海',
		latitude: boundedNumber(source.latitude, 31.2304, -90, 90),
		longitude: boundedNumber(source.longitude, 121.4737, -180, 180),
		forecastDays: boundedNumber(source.forecastDays, 3, 1, 7),
		refreshMinutes: boundedNumber(source.refreshMinutes, 30, 10, 360),
	} satisfies WeatherDashboardModuleConfig;
	if (kind === 'calendar') return {
		showLunar: source.showLunar !== false,
		showHolidays: source.showHolidays !== false,
		weekStartsOn: source.weekStartsOn === 0 ? 0 : 1,
		useCheckInData: source.useCheckInData === true,
		checkInCardId: typeof source.checkInCardId === 'string' && source.checkInCardId.trim() ? source.checkInCardId.trim() : null,
		checkInColor: normalizedColor(source.checkInColor, '#22a06b'),
		checkInIcon: typeof source.checkInIcon === 'string' && source.checkInIcon.trim() ? source.checkInIcon.trim() : 'badge-check',
	} satisfies CalendarDashboardModuleConfig;
	if (kind === 'date') return {
		showLunar: source.showLunar !== false,
		showHoliday: source.showHoliday !== false,
		showTime: source.showTime !== false,
		showWeekday: source.showWeekday !== false,
		showSeconds: source.showSeconds !== false,
	} satisfies DateDashboardModuleConfig;
	if (kind === 'todo') return {
		rootPaths: normalizedDirectoryPaths(source.rootPaths),
		excludePaths: normalizedDirectoryPaths(source.excludePaths),
		limit: boundedNumber(source.limit, 30, 1, 100),
		showSource: source.showSource !== false,
		showMetadata: source.showMetadata !== false,
	} satisfies TodoDashboardModuleConfig;
	if (kind === 'note-stats') return {
		rootPath: typeof source.rootPath === 'string' ? source.rootPath.trim().replace(/^\/+|\/+$/gu, '') : '',
		excludePaths: normalizedDirectoryPaths(source.excludePaths),
		topFolderLimit: boundedNumber(source.topFolderLimit, 5, 1, 12),
		extensions: normalizedExtensions(source.extensions),
		metadataKey: typeof source.metadataKey === 'string' ? source.metadataKey.trim() : '',
		metadataValue: typeof source.metadataValue === 'string' ? source.metadataValue.trim() : '',
		metadataFilters: Array.isArray(source.metadataFilters) ? source.metadataFilters.map((value) => {
			const filter = objectValue(value);
			return {
				key: typeof filter.key === 'string' ? filter.key.trim() : '',
				mode: (filter.mode === 'exclude' ? 'exclude' : 'include') as 'include' | 'exclude',
				values: Array.isArray(filter.values) ? filter.values.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean) : [],
			};
		}).filter((f) => f.key) : [],
		displayFields: Array.isArray(source.displayFields)
			? [...new Set(source.displayFields.filter((field): field is NoteStatsDashboardModuleConfig['displayFields'][number] =>
				typeof field === 'string' && NOTE_STATS_FIELDS.has(field),
			))]
			: ['noteCount', 'characterCount', 'folderCount', 'topFolders'],
		fileCountMetrics: Array.isArray(source.fileCountMetrics) ? source.fileCountMetrics.map((value, index) => {
			const metric = objectValue(value);
			const fieldType = typeof metric.fieldType === 'string' && NOTE_STATS_FIELDS.has(metric.fieldType)
				? metric.fieldType as NoteStatsDashboardModuleConfig['fileCountMetrics'][number]['fieldType']
				: 'noteCount';
			return {
				id: typeof metric.id === 'string' && metric.id.trim() ? metric.id.trim() : `metric-${index + 1}`,
				name: typeof metric.name === 'string' && metric.name.trim() ? metric.name.trim() : `文件数量 ${index + 1}`,
				rootPath: typeof metric.rootPath === 'string' ? metric.rootPath.trim().replace(/^\/+|\/+$/gu, '') : '',
				excludePaths: normalizedDirectoryPaths(metric.excludePaths),
				extensions: normalizedExtensions(metric.extensions),
				metadataFilters: Array.isArray(metric.metadataFilters) ? metric.metadataFilters.map((v) => {
					const f = objectValue(v);
					return {
						key: typeof f.key === 'string' ? f.key.trim() : '',
						mode: (f.mode === 'exclude' ? 'exclude' : 'include') as 'include' | 'exclude',
						values: Array.isArray(f.values) ? f.values.filter((val): val is string => typeof val === 'string').map((val) => val.trim()).filter(Boolean) : [],
					};
				}).filter((f) => f.key) : [],
				fieldType,
			};
		}) : [],
	} satisfies NoteStatsDashboardModuleConfig;
	if (kind === 'recent-files') return {
		rootPath: typeof source.rootPath === 'string' ? source.rootPath.trim().replace(/^\/+|\/+$/gu, '') : '',
		excludePaths: normalizedDirectoryPaths(source.excludePaths),
		limit: boundedNumber(source.limit, 8, 3, 30),
		mode: source.mode === 'recent-created' || source.mode === 'recent-edited' || source.mode === 'frequently-opened'
			? source.mode
			: 'recent-files',
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
	if (kind === 'iframe') return {
		url: normalizedWebUrl(source.url),
		width: boundedNumber(source.width, 0, 0, 10000),
		height: boundedNumber(source.height, 0, 0, 10000),
	} satisfies IframeDashboardModuleConfig;
	if (kind === 'countdown') return {
		mode: source.mode === 'countup' ? 'countup' : 'countdown',
		targetDate: typeof source.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(source.targetDate)
			? source.targetDate
			: '',
		eventName: typeof source.eventName === 'string' && source.eventName.trim() ? source.eventName.trim() : '目标日',
		includeToday: source.includeToday === true,
		showTargetDate: source.showTargetDate !== false,
	} satisfies CountdownDashboardModuleConfig;
	if (kind === 'progress') return {
		showWeek: source.showWeek !== false,
		showMonth: source.showMonth !== false,
		showYear: source.showYear !== false,
		fillColor: normalizedColor(source.fillColor, '#ffab00'),
		trackColor: normalizedColor(source.trackColor, '#b3dce8'),
	} satisfies TimeProgressDashboardModuleConfig;
	if (kind === 'check-in') return {
		dailyTarget: boundedNumber(source.dailyTarget, 1, 1, 20),
		buttonLabel: typeof source.buttonLabel === 'string' && source.buttonLabel.trim() ? source.buttonLabel.trim() : '立即打卡',
		showStreak: source.showStreak !== false,
		showTotalDays: source.showTotalDays !== false,
		progressStyle: source.progressStyle === 'semicircle' ? 'semicircle' : 'linear',
	} satisfies CheckInDashboardModuleConfig;
	if (kind === 'heatmap') return {
		rootPaths: normalizedDirectoryPaths(source.rootPaths),
		excludePaths: normalizedDirectoryPaths(source.excludePaths),
		days: source.days === 90 || source.days === 180 ? source.days : 365,
		color: normalizedColor(source.color, '#22a06b'),
		useCheckInData: source.useCheckInData === true,
		checkInCardId: typeof source.checkInCardId === 'string' && source.checkInCardId.trim() ? source.checkInCardId.trim() : null,
	} satisfies HeatmapDashboardModuleConfig;
	if (kind === 'calculator') return {
		expression: typeof source.expression === 'string' ? source.expression : '',
	} satisfies CalculatorDashboardModuleConfig;
	if (kind === 'ip') return {
		networkEnabled: source.networkEnabled === true,
		refreshMinutes: boundedNumber(source.refreshMinutes, 30, 0, 360),
		showGeoLocation: source.showGeoLocation === true,
	} satisfies IpDashboardModuleConfig;
	return {
		chartType: source.chartType === 'bar' || source.chartType === 'pie' ? source.chartType : 'line',
		csv: typeof source.csv === 'string' && source.csv.trim()
			? source.csv.trim()
			: '分类,计划,实际\n一月,10,8\n二月,12,11\n三月,9,13',
		showAxes: source.showAxes !== false,
		showLegend: source.showLegend !== false,
		showDataLabels: source.showDataLabels === true,
		axisColor: normalizedColor(source.axisColor, '#8590a2'),
		legendColor: normalizedColor(source.legendColor, '#626f86'),
		dataLabelColor: normalizedColor(source.dataLabelColor, '#44546f'),
		seriesColors: Array.isArray(source.seriesColors)
			? source.seriesColors.map((color, index) => normalizedColor(color, ['#0c66e4', '#22a06b', '#c25100'][index % 3]!)).slice(0, 8)
			: ['#0c66e4', '#22a06b', '#c25100'],
	} satisfies ChartDashboardModuleConfig;
}
