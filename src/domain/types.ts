export type Uuid = string;
export type IsoDate = string;
export type IsoDateTime = string;
export type IsoSchedule = string;

export type StatusCategory = 'todo' | 'in_progress' | 'done';
export type CompletionResult = 'completed' | 'terminated';
export type TaskPriority = 'high' | 'medium' | 'low';

export type TaskFormField =
	| 'title'
	| 'priority'
	| 'reporter'
	| 'assignee'
	| 'startDate'
	| 'dueDate'
	| 'completedAt'
	| 'terminatedAt'
	| 'tags'
	| 'body'
	| 'links'
	| 'subtasks'
	| 'relations'
	| 'notes'
	| 'customFields';

export interface TaskFieldRule {
	enabled: boolean;
	required: boolean;
	defaultValue?: unknown;
}

export type TaskFieldConfig = Partial<Record<TaskFormField, TaskFieldRule>>;

export interface Person {
	id: Uuid;
	name: string;
	active: boolean;
}

export interface GlobalConfig {
	kind: 'global-config';
	schema: 1;
	projectConfigDirectory: string;
	defaultTaskDirectory: string;
	currentUserId: Uuid;
	people: Person[];
}

export interface TaskTypeDefinition {
	id: string;
	name: string;
	icon: string;
	color: string;
	marker?: string;
	titleColor?: string;
	active: boolean;
	template: string | null;
	fieldConfig?: TaskFieldConfig;
}

export type CustomFieldType =
	| 'text'
	| 'multiline-text'
	| 'number'
	| 'boolean'
	| 'date'
	| 'datetime'
	| 'single-select'
	| 'multi-select'
	| 'user'
	| 'task-reference';

export interface CustomFieldOption {
	id: string;
	name: string;
}

export interface CustomFieldDefinition {
	id: string;
	key: string;
	name: string;
	type: CustomFieldType;
	required: boolean;
	active: boolean;
	default: unknown;
	options?: CustomFieldOption[];
	taskTypeIds?: string[];
}

export interface WorkflowStatus {
	id: string;
	name: string;
	category: StatusCategory;
	result: CompletionResult | null;
	active: boolean;
	position?: { x: number; y: number };
}

export interface WorkflowTransition {
	id: string;
	name: string;
	from: string;
	to: string;
}

export interface WorkflowDefinition {
	initialStatusId: string;
	statuses: WorkflowStatus[];
	transitions: WorkflowTransition[];
}

export interface ProjectConfig {
	kind: 'project';
	schema: 1;
	uid: Uuid;
	code: string;
	name: string;
	active: boolean;
	taskDirectory: string;
	groupByMonth: boolean;
	nextNumber: number;
	templateId?: string | null;
	templateIds?: string[];
	taskTypes: TaskTypeDefinition[];
	customFields: CustomFieldDefinition[];
	workflow: WorkflowDefinition;
}

export interface TaskConfigurationTemplate {
	id: string;
	name: string;
	description: string;
	taskTypes: TaskTypeDefinition[];
	customFields: CustomFieldDefinition[];
	workflow: WorkflowDefinition;
}

export interface ProjectFilterDefinition {
	projectUid: string;
	keyword?: string;
	statusIds?: string[];
	taskTypeIds?: string[];
	reporterIds?: string[];
	assigneeIds?: string[];
	tags?: string[];
	statusCategories?: string[];
	createdAtFrom?: string;
	createdAtTo?: string;
	startDateFrom?: string;
	startDateTo?: string;
	dueDateFrom?: string;
	dueDateTo?: string;
	completedAtFrom?: string;
	completedAtTo?: string;
	hasIncompleteSubtasks?: boolean;
	customFields?: Record<string, unknown[]>;
}

export interface TagStyle {
	icon?: string;
	color?: string;
}

export interface TagGroup {
	id: Uuid;
	name: string;
	order: number;
}

export interface SavedProjectFilter {
	id: Uuid;
	name: string;
	projectUid: Uuid | null;
	filters: ProjectFilterDefinition;
	createdAt: IsoDateTime;
	updatedAt: IsoDateTime;
}

export type BuiltInTaskDisplayField =
	| 'key'
	| 'title'
	| 'project'
	| 'type'
	| 'status'
	| 'priority'
	| 'reporter'
	| 'assignee'
	| 'startDate'
	| 'dueDate'
	| 'tags'
	| 'customFields'
	| 'relations'
	| 'links'
	| 'subtasks';

export type CustomTaskDisplayField = `custom:${string}`;
export type TaskDisplayField = BuiltInTaskDisplayField | CustomTaskDisplayField | 'customFields';

export type PersonalDashboardCardId = string;
export type DashboardModuleKind = 'weather' | 'calendar' | 'note-stats' | 'recent-files' | 'news' | 'directory';
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
	filterId: string | null;
	kind: DashboardCardKind;
	metric: DashboardMetric;
	displayFields: TaskDisplayField[];
	taskListDirection?: 'horizontal' | 'vertical';
	title?: string;
	numberColor?: string;
	backgroundColor?: string;
	moduleConfig?: DashboardModuleConfig;
}

export interface WeatherDashboardModuleConfig {
	networkEnabled: boolean;
	locationName: string;
	latitude: number;
	longitude: number;
	refreshMinutes: number;
}

export interface CalendarDashboardModuleConfig {
	showLunar: boolean;
	weekStartsOn: 0 | 1;
}

export interface NoteStatsDashboardModuleConfig {
	rootPath: string;
	topFolderLimit: number;
}

export interface RecentFilesDashboardModuleConfig {
	rootPath: string;
	limit: number;
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

export type DashboardModuleConfig =
	| WeatherDashboardModuleConfig
	| CalendarDashboardModuleConfig
	| NoteStatsDashboardModuleConfig
	| RecentFilesDashboardModuleConfig
	| NewsDashboardModuleConfig
	| DirectoryDashboardModuleConfig;

export interface TaskMetadata {
	kind: 'task';
	schema: 1;
	uid: Uuid;
	key: string;
	projectUid: Uuid;
	title: string;
	taskTypeId: string;
	priority?: TaskPriority;
	createdAt: IsoDateTime;
	startDate: IsoSchedule | null;
	dueDate: IsoSchedule | null;
	completedAt: IsoDateTime | null;
	terminatedAt: IsoDateTime | null;
	reporterId: Uuid;
	assigneeId: Uuid | null;
	statusId: string;
	tags: string[];
	custom: Record<string, unknown>;
}

export type RelationType = 'parent' | 'related';

export interface TaskRelation {
	id: Uuid;
	type: RelationType;
	targetUid: Uuid;
	targetKey: string;
	targetTitle: string;
}

export interface TaskNote {
	id: Uuid;
	authorId: Uuid;
	createdAt: IsoDateTime;
	authorName: string;
	content: string;
}

export interface TaskDocument {
	metadata: TaskMetadata;
	body: string;
	subtasks?: string;
	relations: TaskRelation[];
	notes: TaskNote[];
	unknownFrontmatter: Record<string, unknown>;
	unknownLinks: string[];
	lineEnding: '\n' | '\r\n';
}

export interface ValidationIssue {
	code: string;
	path: string;
	message: string;
}

export type ValidationResult<T> =
	| { success: true; data: T; issues: [] }
	| { success: false; data?: T; issues: ValidationIssue[] };
