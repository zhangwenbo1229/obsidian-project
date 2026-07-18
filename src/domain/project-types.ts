import type { Uuid, IsoDateTime } from './common-types';
import type { TaskTypeDefinition, CustomFieldDefinition, WorkflowDefinition } from './task-types';

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
	scheduledDateFrom?: string;
	scheduledDateTo?: string;
	startDateFrom?: string;
	startDateTo?: string;
	dueDateFrom?: string;
	dueDateTo?: string;
	endDateFrom?: string;
	endDateTo?: string;
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