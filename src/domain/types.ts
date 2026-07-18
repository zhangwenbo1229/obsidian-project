// Barrel file — all domain types re-exported from sub-modules.
// Modules are located under:
//   common-types.ts  — Uuid, IsoDate, IsoDateTime, IsoSchedule
//   person-types.ts  — Person, PersonMetadataFieldType, PersonMetadataFieldDefinition, PersonNamePresentation, CustomFieldOption
//   global-config-types.ts — GlobalConfig
//   task-types.ts    — TaskMetadata, TaskDocument, TaskRelation, TaskNote, EmbeddedSubtask, TaskFormField, etc.
//   project-types.ts — ProjectConfig, ProjectFilterDefinition, WorkflowDefinition, SavedProjectFilter, TagStyle, TagGroup
//   dashboard-types.ts — DashboardModuleKind, DashboardModuleConfig, PersonalDashboardCardLayout, etc.

export type {
	Uuid,
	IsoDate,
	IsoDateTime,
	IsoSchedule,
} from './common-types';

export type {
	Person,
	PersonMetadataFieldType,
	PersonMetadataFieldDefinition,
	PersonNamePresentation,
	CustomFieldOption,
} from './person-types';

export type { GlobalConfig } from './global-config-types';

export type {
	StatusCategory,
	CompletionResult,
	TaskPriority,
	ProjectPriority,
	TaskFormField,
	TaskFieldRule,
	TaskFieldConfig,
	EmbeddedSubtask,
	CustomFieldType,
	CustomFieldDefinition,
	TaskTypeDefinition,
	TaskConfigurationTemplate,
	WorkflowStatus,
	WorkflowTransition,
	WorkflowDefinition,
	BuiltInTaskDisplayField,
	CustomTaskDisplayField,
	TaskDisplayField,
	TaskMetadata,
	RelationType,
	TaskRelation,
	TaskNote,
	TaskDocument,
	ValidationIssue,
	ValidationResult,
} from './task-types';

export type {
	ProjectConfig,
	ProjectFilterDefinition,
	TagStyle,
	TagGroup,
	SavedProjectFilter,
} from './project-types';

export type {
	PersonalDashboardCardId,
	DashboardModuleKind,
	DashboardCardKind,
	DashboardMetric,
	PersonalDashboardCardLayout,
	WeatherDashboardModuleConfig,
	WeatherProviderId,
	CalendarDashboardModuleConfig,
	NoteStatsDashboardModuleConfig,
	NoteCountMetricConfig,
	NoteStatsDisplayField,
	RecentFilesDashboardModuleConfig,
	NewsDashboardModuleConfig,
	DirectoryDashboardModuleConfig,
	TextDashboardModuleConfig,
	IframeDashboardModuleConfig,
	DashboardChartType,
	ChartDashboardModuleConfig,
	DateDashboardModuleConfig,
	TodoDashboardModuleConfig,
	CountdownDashboardModuleConfig,
	HeatmapDashboardModuleConfig,
	TimeProgressDashboardModuleConfig,
	CheckInDashboardModuleConfig,
	CalculatorDashboardModuleConfig,
	IpDashboardModuleConfig,
	DashboardModuleConfig,
} from './dashboard-types';