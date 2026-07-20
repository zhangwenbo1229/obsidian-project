import type { Uuid, IsoDate, IsoDateTime, IsoSchedule } from './common-types';
import type { CustomFieldOption } from './person-types';
import type { ProjectTemplateMetadataRef } from './metadata-types';

export type StatusCategory = 'todo' | 'in_progress' | 'done';
export type CompletionResult = 'completed' | 'terminated';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ProjectPriority = string;

export type TaskFormField =
	| 'title'
	| 'priority'
	| 'reporter'
	| 'assignee'
	| 'scheduledDate'
	| 'startDate'
	| 'dueDate'
	| 'endDate'
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
	icon?: string;
	color?: string;
	options?: CustomFieldOption[];
}

export interface EmbeddedSubtask {
	id: string;
	title: string;
	completed: boolean;
	priority: TaskPriority;
	scheduledDate: IsoDate | null;
	startDate: IsoSchedule | null;
	dueDate: IsoSchedule | null;
	tags: string[];
	createdDate: IsoDate | null;
	doneDate: IsoDate | null;
	cancelledDate: IsoDate | null;
	custom?: Record<string, unknown>;
}

export type TaskFieldConfig = Partial<Record<TaskFormField, TaskFieldRule>>;

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
	icon?: string;
	color?: string;
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

export interface TaskConfigurationTemplate {
	id: string;
	name: string;
	description: string;
	taskTypes: TaskTypeDefinition[];
	customFields: CustomFieldDefinition[];
	/** 迁移后使用统一元数据引用 */
	customFieldRefs?: ProjectTemplateMetadataRef[];
	workflow: WorkflowDefinition;
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

export type BuiltInTaskDisplayField =
	| 'key'
	| 'title'
	| 'project'
	| 'type'
	| 'status'
	| 'priority'
	| 'reporter'
	| 'assignee'
	| 'scheduledDate'
	| 'startDate'
	| 'dueDate'
	| 'endDate'
	| 'tags'
	| 'customFields'
	| 'relations'
	| 'links'
	| 'subtasks';

export type CustomTaskDisplayField = `custom:${string}`;
export type TaskDisplayField = BuiltInTaskDisplayField | CustomTaskDisplayField | 'customFields';

export interface TaskMetadata {
	kind: 'task';
	schema: 1;
	uid: Uuid;
	key: string;
	projectUid: Uuid;
	title: string;
	taskTypeId: string;
	priority?: ProjectPriority;
	createdAt: IsoDateTime;
	scheduledDate?: IsoSchedule | null;
	startDate: IsoSchedule | null;
	dueDate: IsoSchedule | null;
	endDate?: IsoSchedule | null;
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