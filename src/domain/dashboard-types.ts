import type { TaskDisplayField } from './task-types';

export type PersonalDashboardCardId = string;
export type DashboardModuleKind = 'weather' | 'calendar' | 'date' | 'todo' | 'note-stats' | 'recent-files' | 'news' | 'directory' | 'text' | 'chart' | 'countdown' | 'progress' | 'check-in' | 'heatmap' | 'iframe' | 'calculator' | 'ip';
export type DashboardCardKind = 'number' | 'percentage' | 'task-list' | DashboardModuleKind;
export type DashboardMetric =
	| 'total'
	| 'completed'
	| 'incomplete'
	| 'terminated'
	| 'overdue'
	| 'completion-rate'
	| 'overdue-rate';

export interface PersonalDashboardCardLayout {
	id: PersonalDashboardCardId;
	order: number;
	columnSpan: number;
	rowSpan: number;
	columnStart?: number;
	rowStart?: number;
	filterId: string | null;
	kind: DashboardCardKind;
	metric: DashboardMetric;
	displayFields: TaskDisplayField[];
	taskListDirection?: 'horizontal' | 'vertical';
	title?: string;
	numberColor?: string;
	backgroundColor?: string;
	fontSize?: number;
	dataSource?: 'project' | 'task';
	percentageDataMode?: 'task' | 'manual' | 'direct';
	percentageCurrent?: number;
	percentageTarget?: number;
	percentageValue?: number;
	percentageDisplay?: 'number' | 'progress';
	percentageProgressStyle?: 'linear' | 'semicircle';
	moduleConfig?: DashboardModuleConfig;
}

export interface WeatherDashboardModuleConfig {
	networkEnabled: boolean;
	provider: WeatherProviderId;
	locationName: string;
	latitude: number;
	longitude: number;
	forecastDays: number;
	refreshMinutes: number;
}

export type WeatherProviderId = 'open-meteo' | 'qweather' | 'openweathermap';

export interface CalendarDashboardModuleConfig {
	showLunar: boolean;
	showHolidays: boolean;
	weekStartsOn: 0 | 1;
	useCheckInData: boolean;
	checkInCardId: string | null;
	checkInColor: string;
	checkInIcon: string;
}

export interface NoteMetadataFilter {
	key: string;
	mode: 'include' | 'exclude';
	values: string[];
}

export interface NoteStatsDashboardModuleConfig {
	rootPath: string;
	excludePaths: string[];
	topFolderLimit: number;
	extensions: string[];
	metadataKey: string;
	metadataValue: string;
	metadataFilters: NoteMetadataFilter[];
	displayFields: NoteStatsDisplayField[];
	fileCountMetrics: NoteCountMetricConfig[];
}

export interface NoteCountMetricConfig {
	id: string;
	name: string;
	rootPath: string;
	excludePaths: string[];
	extensions: string[];
	metadataFilters: NoteMetadataFilter[];
	fieldType: NoteStatsDisplayField;
}

export type NoteStatsDisplayField = 'noteCount' | 'characterCount' | 'folderCount' | 'totalSize' | 'topFolders';

export interface RecentFilesDashboardModuleConfig {
	rootPath: string;
	excludePaths: string[];
	limit: number;
	mode: 'recent-files' | 'recent-created' | 'recent-edited' | 'frequently-opened';
}

export interface NewsDashboardModuleConfig {
	networkEnabled: boolean;
	feedUrls: string[];
	pageSize: number;
	refreshMinutes: number;
}

export interface DirectoryDashboardModuleConfig {
	rootPaths: string[];
	maxDepth: number;
}

export interface TextDashboardModuleConfig {
	markdown: string;
}

export interface IframeDashboardModuleConfig {
	url: string;
	width?: number;
	height?: number;
}

export type DashboardChartType = 'line' | 'bar' | 'pie';

export interface ChartDashboardModuleConfig {
	chartType: DashboardChartType;
	csv: string;
	showAxes: boolean;
	showLegend: boolean;
	showDataLabels: boolean;
	axisColor: string;
	legendColor: string;
	dataLabelColor: string;
	seriesColors: string[];
}

export interface DateDashboardModuleConfig {
	showLunar: boolean;
	showHoliday: boolean;
	showTime: boolean;
	showWeekday: boolean;
	showSeconds: boolean;
}

export interface TodoDashboardModuleConfig {
	rootPaths: string[];
	excludePaths: string[];
	limit: number;
	showSource: boolean;
	showMetadata: boolean;
}

export interface CountdownDashboardModuleConfig {
	mode: 'countdown' | 'countup';
	targetDate: string;
	eventName: string;
	includeToday: boolean;
	showTargetDate: boolean;
}

export interface HeatmapDashboardModuleConfig {
	rootPaths: string[];
	excludePaths: string[];
	days: number;
	color: string;
	useCheckInData: boolean;
	checkInCardId: string | null;
}

export interface TimeProgressDashboardModuleConfig {
	showWeek: boolean;
	showMonth: boolean;
	showYear: boolean;
	fillColor: string;
	trackColor: string;
}

export interface CheckInDashboardModuleConfig {
	dailyTarget: number;
	buttonLabel: string;
	showStreak: boolean;
	showTotalDays: boolean;
	progressStyle: 'linear' | 'semicircle';
}

export interface CalculatorDashboardModuleConfig {
	expression: string;
}

export interface IpDashboardModuleConfig {
	networkEnabled: boolean;
	refreshMinutes: number;
	showGeoLocation: boolean;
}

export type DashboardModuleConfig =
	| WeatherDashboardModuleConfig
	| CalendarDashboardModuleConfig
	| NoteStatsDashboardModuleConfig
	| RecentFilesDashboardModuleConfig
	| NewsDashboardModuleConfig
	| DirectoryDashboardModuleConfig
	| TextDashboardModuleConfig
	| IframeDashboardModuleConfig
	| ChartDashboardModuleConfig
	| DateDashboardModuleConfig
	| TodoDashboardModuleConfig
	| CountdownDashboardModuleConfig
	| TimeProgressDashboardModuleConfig
	| CheckInDashboardModuleConfig
	| HeatmapDashboardModuleConfig
	| CalculatorDashboardModuleConfig
	| IpDashboardModuleConfig;