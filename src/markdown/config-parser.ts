import type {
	CustomFieldDefinition,
	GlobalConfig,
	ProjectConfig,
	TaskTypeDefinition,
	WorkflowDefinition,
} from '../domain/types';
import {
	validateGlobalConfig,
	validateProjectConfig,
} from '../domain/validation';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter';

export interface ConfigParseResult<T> {
	config: T | null;
	issues: ReturnType<typeof validateProjectConfig>['issues'];
}

function record(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function array(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

export function parseGlobalConfigMarkdown(
	source: string,
): ConfigParseResult<GlobalConfig> {
	try {
		const { frontmatter } = parseFrontmatter(source);
		const config: GlobalConfig = {
			kind: frontmatter['pm-kind'] as 'global-config',
			schema: frontmatter['pm-schema'] as 1,
			projectConfigDirectory: text(
				frontmatter['project-config-directory'],
			),
			defaultTaskDirectory: text(frontmatter['default-task-directory']),
			currentUserId: text(frontmatter['current-user-id']),
			people: array(frontmatter.people).map((person) => ({
				id: text(person.id),
				name: text(person.name),
				active: person.active as boolean,
			})),
			personMetadataFields: [],
		};
		const validation = validateGlobalConfig(config);
		return { config, issues: validation.issues };
	} catch (error) {
		return {
			config: null,
			issues: [
				{
					code: 'invalid-frontmatter',
					path: '',
					message: error instanceof Error ? error.message : String(error),
				},
			],
		};
	}
}

function mapTaskType(value: Record<string, unknown>): TaskTypeDefinition {
	return {
		id: text(value.id),
		name: text(value.name),
		icon: text(value.icon),
		color: text(value.color),
		marker: text(value.marker) || undefined,
		titleColor: text(value.titleColor) || undefined,
		active: value.active as boolean,
		template: typeof value.template === 'string' ? value.template : null,
	};
}

function mapCustomField(value: Record<string, unknown>): CustomFieldDefinition {
	return {
		id: text(value.id),
		key: text(value.key),
		name: text(value.name),
		type: value.type as CustomFieldDefinition['type'],
		required: value.required as boolean,
		active: value.active as boolean,
		default: value.default,
		options: Array.isArray(value.options)
			? array(value.options).map((option) => ({
					id: text(option.id),
					name: text(option.name),
				}))
			: undefined,
	};
}

function mapWorkflow(value: Record<string, unknown>): WorkflowDefinition {
	return {
		initialStatusId: text(value['initial-status-id']),
		statuses: array(value.statuses).map((status) => ({
			id: text(status.id),
			name: text(status.name),
			category: status.category as WorkflowDefinition['statuses'][number]['category'],
			result: (status.result ?? null) as WorkflowDefinition['statuses'][number]['result'],
			active: status.active as boolean,
		})),
		transitions: array(value.transitions).map((transition) => ({
			id: text(transition.id),
			name: text(transition.name),
			from: text(transition.from),
			to: text(transition.to),
		})),
	};
}

export function parseProjectConfigMarkdown(
	source: string,
): ConfigParseResult<ProjectConfig> {
	try {
		const { frontmatter } = parseFrontmatter(source);
		const config: ProjectConfig = {
			kind: frontmatter['pm-kind'] as 'project',
			schema: frontmatter['pm-schema'] as 1,
			uid: text(frontmatter['project-uid']),
			code: text(frontmatter.code),
			name: text(frontmatter.name),
			active: frontmatter.active as boolean,
			taskDirectory: text(frontmatter['task-directory']),
			groupByMonth: frontmatter['group-by-month'] as boolean,
			nextNumber: Number(frontmatter['next-number']),
			taskTypes: array(frontmatter['task-types']).map(mapTaskType),
			customFields: array(frontmatter['custom-fields']).map(mapCustomField),
			workflow: mapWorkflow(record(frontmatter.workflow)),
		};
		const validation = validateProjectConfig(config);
		return { config, issues: validation.issues };
	} catch (error) {
		return {
			config: null,
			issues: [
				{
					code: 'invalid-frontmatter',
					path: '',
					message: error instanceof Error ? error.message : String(error),
				},
			],
		};
	}
}

export function serializeProjectConfigMarkdown(config: ProjectConfig): string {
	return serializeFrontmatter({
		'pm-kind': config.kind,
		'pm-schema': config.schema,
		'project-uid': config.uid,
		code: config.code,
		name: config.name,
		active: config.active,
		'task-directory': config.taskDirectory,
		'group-by-month': config.groupByMonth,
		'next-number': config.nextNumber,
		'task-types': config.taskTypes,
		'custom-fields': config.customFields,
		workflow: {
			'initial-status-id': config.workflow.initialStatusId,
			statuses: config.workflow.statuses,
			transitions: config.workflow.transitions,
		},
	}, '');
}

export function serializeGlobalConfigMarkdown(config: GlobalConfig): string {
	return serializeFrontmatter({
		'pm-kind': config.kind,
		'pm-schema': config.schema,
		'project-config-directory': config.projectConfigDirectory,
		'default-task-directory': config.defaultTaskDirectory,
		'current-user-id': config.currentUserId,
		people: config.people,
	}, '');
}
