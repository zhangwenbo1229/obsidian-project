import { RESERVED_TASK_HEADINGS, RESERVED_TASK_KEYS } from '../constants';
import type {
	CustomFieldDefinition,
	GlobalConfig,
	ProjectConfig,
	TaskMetadata,
	ValidationIssue,
	ValidationResult,
} from './types';
import {
	isIsoDate,
	isIsoDateTimeWithOffset,
} from '../utils/dates';
import { isTaskKey, isUuidV4 } from '../utils/ids';

export { isIsoDate, isIsoDateTimeWithOffset, isTaskKey, isUuidV4 };

function issue(code: string, path: string, message: string): ValidationIssue {
	return { code, path, message };
}

function result<T>(data: T, issues: ValidationIssue[]): ValidationResult<T> {
	return issues.length === 0
		? { success: true, data, issues: [] }
		: { success: false, data, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function validateUuid(
	value: unknown,
	path: string,
	issues: ValidationIssue[],
): void {
	if (!isUuidV4(value)) {
		issues.push(issue('invalid-uuid', path, `${path} 必须是 UUID v4。`));
	}
}

export function validateGlobalConfig(value: unknown): ValidationResult<GlobalConfig> {
	const issues: ValidationIssue[] = [];
	if (!isRecord(value)) {
		return {
			success: false,
			issues: [issue('invalid-config', '', '全局配置必须是对象。')],
		};
	}

	if (value.kind !== 'global-config') {
		issues.push(issue('invalid-kind', 'kind', '配置类型必须是 global-config。'));
	}
	if (value.schema !== 1) {
		issues.push(issue('unsupported-schema', 'schema', '仅支持配置版本 1。'));
	}
	if (!nonEmptyString(value.projectConfigDirectory)) {
		issues.push(issue('invalid-path', 'projectConfigDirectory', '项目配置目录不能为空。'));
	}
	if (!nonEmptyString(value.defaultTaskDirectory)) {
		issues.push(issue('invalid-path', 'defaultTaskDirectory', '默认任务目录不能为空。'));
	}
	validateUuid(value.currentUserId, 'currentUserId', issues);

	const people = Array.isArray(value.people) ? value.people : [];
	if (!Array.isArray(value.people)) {
		issues.push(issue('invalid-people', 'people', '人员列表必须是数组。'));
	}
	const personIds = new Set<string>();
	for (const [index, person] of people.entries()) {
		if (!isRecord(person)) {
			issues.push(issue('invalid-person', `people.${index}`, '人员必须是对象。'));
			continue;
		}
		validateUuid(person.id, `people.${index}.id`, issues);
		if (typeof person.id === 'string') {
			if (personIds.has(person.id)) {
				issues.push(issue('duplicate-person-id', `people.${index}.id`, '人员 ID 重复。'));
			}
			personIds.add(person.id);
		}
		if (!nonEmptyString(person.name)) {
			issues.push(issue('empty-person-name', `people.${index}.name`, '人员名称不能为空。'));
		}
		if (typeof person.active !== 'boolean') {
			issues.push(issue('invalid-boolean', `people.${index}.active`, 'active 必须是布尔值。'));
		}
	}
	if (
		typeof value.currentUserId === 'string' &&
		!personIds.has(value.currentUserId)
	) {
		issues.push(issue('current-user-missing', 'currentUserId', '当前用户不在人员列表中。'));
	}

	return result(value as unknown as GlobalConfig, issues);
}

export function validateProjectConfig(value: unknown): ValidationResult<ProjectConfig> {
	const issues: ValidationIssue[] = [];
	if (!isRecord(value)) {
		return {
			success: false,
			issues: [issue('invalid-project', '', '项目配置必须是对象。')],
		};
	}

	if (value.kind !== 'project') issues.push(issue('invalid-kind', 'kind', '项目类型错误。'));
	if (value.schema !== 1) issues.push(issue('unsupported-schema', 'schema', '仅支持项目版本 1。'));
	validateUuid(value.uid, 'uid', issues);
	if (typeof value.code !== 'string' || !/^[A-Z][A-Z0-9]*$/.test(value.code)) {
		issues.push(issue('invalid-project-code', 'code', '项目代码格式无效。'));
	}
	if (!nonEmptyString(value.name)) issues.push(issue('empty-project-name', 'name', '项目名称不能为空。'));
	if (!Number.isSafeInteger(value.nextNumber) || Number(value.nextNumber) < 1) {
		issues.push(issue('invalid-next-number', 'nextNumber', '下一个编号必须是正整数。'));
	}
	const taskTypes = Array.isArray(value.taskTypes) ? value.taskTypes : [];
	const taskTypeIds = new Set<string>();
	for (const [index, taskType] of taskTypes.entries()) {
		if (!isRecord(taskType) || !nonEmptyString(taskType.id) || !nonEmptyString(taskType.name)) {
			issues.push(issue('invalid-task-type', `taskTypes.${index}`, '任务类型必须包含 ID 和名称。'));
			continue;
		}
		if (taskTypeIds.has(taskType.id)) issues.push(issue('duplicate-task-type-id', `taskTypes.${index}.id`, '任务类型 ID 重复。'));
		taskTypeIds.add(taskType.id);
		issues.push(...validateTemplate(typeof taskType.template === 'string' ? taskType.template : null));
	}
	const customFields = Array.isArray(value.customFields) ? value.customFields : [];
	const customKeys = new Set<string>();
	for (const [index, customField] of customFields.entries()) {
		if (!isRecord(customField) || !nonEmptyString(customField.key)) {
			issues.push(issue('invalid-custom-field', `customFields.${index}`, '自定义字段无效。'));
			continue;
		}
		if (!isAllowedCustomFieldKey(customField.key)) {
			issues.push(issue('invalid-custom-field-key', `customFields.${index}.key`, '自定义字段键格式无效或与基础字段冲突。'));
		}
		if (customKeys.has(customField.key)) issues.push(issue('duplicate-custom-field-key', `customFields.${index}.key`, '自定义字段键重复。'));
		customKeys.add(customField.key);
	}

	const workflow = isRecord(value.workflow) ? value.workflow : undefined;
	if (!workflow) {
		issues.push(issue('invalid-workflow', 'workflow', '工作流不能为空。'));
		return result(value as unknown as ProjectConfig, issues);
	}
	const statuses = Array.isArray(workflow.statuses) ? workflow.statuses : [];
	const statusIds = new Set<string>();
	let hasCompletedStatus = false;
	for (const [index, status] of statuses.entries()) {
		if (!isRecord(status) || !nonEmptyString(status.id)) {
			issues.push(issue('invalid-status', `workflow.statuses.${index}`, '状态无效。'));
			continue;
		}
		if (statusIds.has(status.id)) {
			issues.push(issue('duplicate-status-id', `workflow.statuses.${index}.id`, '状态 ID 重复。'));
		}
		statusIds.add(status.id);
		if (status.category === 'done') {
			if (status.result !== 'completed' && status.result !== 'terminated') {
				issues.push(issue('invalid-status-result', `workflow.statuses.${index}.result`, '结束状态必须指定完成或终止结果。'));
			}
			if (status.result === 'completed') hasCompletedStatus = true;
		} else if (status.result !== null) {
			issues.push(issue('invalid-status-result', `workflow.statuses.${index}.result`, '非结束状态不能指定结束结果。'));
		}
	}
	if (!statusIds.has(String(workflow.initialStatusId))) {
		issues.push(issue('initial-status-missing', 'workflow.initialStatusId', '初始状态不存在。'));
	}
	if (!hasCompletedStatus) {
		issues.push(issue('completion-status-missing', 'workflow.statuses', '至少需要一个正常完成状态。'));
	}
	const transitions = Array.isArray(workflow.transitions) ? workflow.transitions : [];
	for (const [index, transition] of transitions.entries()) {
		if (
			!isRecord(transition) ||
			!statusIds.has(String(transition.from)) ||
			!statusIds.has(String(transition.to))
		) {
			issues.push(issue('transition-status-missing', `workflow.transitions.${index}`, '转换引用了不存在的状态。'));
		}
	}

	return result(value as unknown as ProjectConfig, issues);
}

export function validateTaskMetadata(value: unknown): ValidationResult<TaskMetadata> {
	const issues: ValidationIssue[] = [];
	if (!isRecord(value)) {
		return {
			success: false,
			issues: [issue('invalid-task', '', '任务元数据必须是对象。')],
		};
	}
	if (value.kind !== 'task') issues.push(issue('invalid-kind', 'kind', '任务类型标记错误。'));
	if (value.schema !== 1) issues.push(issue('unsupported-schema', 'schema', '仅支持任务版本 1。'));
	validateUuid(value.uid, 'uid', issues);
	validateUuid(value.projectUid, 'projectUid', issues);
	if (!isTaskKey(value.key)) issues.push(issue('invalid-key', 'key', '任务 Key 格式无效。'));
	if (!nonEmptyString(value.title)) issues.push(issue('empty-title', 'title', '任务标题不能为空。'));
	if (!nonEmptyString(value.taskTypeId)) issues.push(issue('invalid-task-type', 'taskTypeId', '任务类型不能为空。'));
	if (
		value.priority !== undefined &&
		!nonEmptyString(value.priority)
	) {
		issues.push(issue('invalid-priority', 'priority', '优先级必须是非空文本。'));
	}
	if (!isIsoDateTimeWithOffset(value.createdAt)) issues.push(issue('invalid-datetime', 'createdAt', '创建时间必须包含时区。'));
	for (const field of ['scheduledDate', 'startDate', 'dueDate', 'endDate'] as const) {
		if (value[field] !== null && value[field] !== undefined && !isIsoDate(value[field]) && !isIsoDateTimeWithOffset(value[field])) {
			issues.push(issue('invalid-date', field, `${field} 必须是有效日期或带时区的日期时间。`));
		}
	}
	for (const field of ['completedAt', 'terminatedAt'] as const) {
		if (value[field] !== null && !isIsoDateTimeWithOffset(value[field])) {
			issues.push(issue('invalid-datetime', field, `${field} 必须包含时区。`));
		}
	}
	validateUuid(value.reporterId, 'reporterId', issues);
	if (value.assigneeId !== null) validateUuid(value.assigneeId, 'assigneeId', issues);
	if (!nonEmptyString(value.statusId)) issues.push(issue('invalid-status', 'statusId', '状态不能为空。'));
	if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== 'string')) {
		issues.push(issue('invalid-tags', 'tags', '标签必须是字符串数组。'));
	}
	if (!isRecord(value.custom)) issues.push(issue('invalid-custom-fields', 'custom', '自定义字段必须是对象。'));

	return result(value as unknown as TaskMetadata, issues);
}

export function validateCustomFieldValue(
	field: CustomFieldDefinition,
	value: unknown,
): ValidationIssue[] {
	const path = field.key;
	if (value === null || value === undefined || value === '') {
		return field.required
			? [issue('required-custom-field', path, `${field.name} 为必填字段。`)]
			: [];
	}

	switch (field.type) {
		case 'text':
		case 'multiline-text':
			return typeof value === 'string' ? [] : [issue('invalid-custom-type', path, '值必须是文本。')];
		case 'number':
			return typeof value === 'number' && Number.isFinite(value)
				? []
				: [issue('invalid-custom-type', path, '值必须是数字。')];
		case 'boolean':
			return typeof value === 'boolean' ? [] : [issue('invalid-custom-type', path, '值必须是布尔值。')];
		case 'date':
			return isIsoDate(value) ? [] : [issue('invalid-date', path, '值必须是有效日期。')];
		case 'datetime':
			return isIsoDateTimeWithOffset(value)
				? []
				: [issue('invalid-datetime', path, '值必须是带时区的日期时间。')];
		case 'user':
		case 'task-reference':
			return isUuidV4(value) ? [] : [issue('invalid-uuid', path, '值必须是 UUID v4。')];
		case 'single-select': {
			const optionIds = new Set((field.options ?? []).map((option) => option.id));
			return typeof value === 'string' && optionIds.has(value)
				? []
				: [issue('invalid-option', path, '值不在可用选项中。')];
		}
		case 'multi-select': {
			const optionIds = new Set((field.options ?? []).map((option) => option.id));
			return Array.isArray(value) && value.every((item) => typeof item === 'string' && optionIds.has(item))
				? []
				: [issue('invalid-option', path, '存在无效的多选值。')];
		}
	}
}

export function validateTaskReferences(
	task: TaskMetadata,
	project: ProjectConfig,
	personIds: ReadonlySet<string>,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	if (task.projectUid !== project.uid) issues.push(issue('project-mismatch', 'projectUid', '任务所属项目不匹配。'));
	if (!project.taskTypes.some((type) => type.id === task.taskTypeId)) issues.push(issue('task-type-missing', 'taskTypeId', '任务类型不存在。'));
	const status = project.workflow.statuses.find((item) => item.id === task.statusId);
	if (!status) issues.push(issue('status-missing', 'statusId', '任务状态不存在。'));
	if (!personIds.has(task.reporterId)) issues.push(issue('reporter-missing', 'reporterId', '提报人不存在。'));
	if (task.assigneeId && !personIds.has(task.assigneeId)) issues.push(issue('assignee-missing', 'assigneeId', '经办人不存在。'));
	if (status?.category === 'done' && status.result === 'completed') {
		if (!task.completedAt) issues.push(issue('completed-date-missing', 'completedAt', '正常完成任务必须填写完成日期。'));
		if (task.terminatedAt) issues.push(issue('unexpected-terminated-date', 'terminatedAt', '正常完成任务不能填写终止日期。'));
	} else if (status?.category === 'done' && status.result === 'terminated') {
		if (!task.terminatedAt) issues.push(issue('terminated-date-missing', 'terminatedAt', '终止任务必须填写终止日期。'));
		if (task.completedAt) issues.push(issue('unexpected-completed-date', 'completedAt', '终止任务不能填写完成日期。'));
	} else if (task.completedAt || task.terminatedAt) {
		issues.push(issue('unexpected-ending-date', 'statusId', '未结束任务不能填写完成或终止日期。'));
	}
	for (const field of project.customFields) {
		issues.push(...validateCustomFieldValue(field, task.custom[field.key]));
	}
	return issues;
}

export function validateTemplate(template: string | null): ValidationIssue[] {
	if (template === null) return [];
	const issues: ValidationIssue[] = [];
	for (const heading of RESERVED_TASK_HEADINGS) {
		if (new RegExp(`^##\\s+${heading}\\s*$`, 'mu').test(template)) {
			issues.push(issue('reserved-template-heading', 'template', `模板不能包含 ## ${heading}。`));
		}
	}
	return issues;
}

export function isAllowedCustomFieldKey(key: string): boolean {
	return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(key) &&
		!key.startsWith('pm-') &&
		!RESERVED_TASK_KEYS.has(key);
}
