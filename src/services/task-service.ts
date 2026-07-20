import type {
	GlobalConfig,
	ProjectConfig,
	ProjectPriority,
	TaskDocument,
	TaskRelation,
	TaskTypeDefinition,
} from '../domain/types';
import type { UnifiedMetadataField } from '../domain/metadata-types';
import type { TaskMetadataSettings } from '../settings/task-metadata-settings';
import { localDate, localDateTime } from '../utils/dates';
import { createUuid } from '../utils/ids';
import { validateCustomFieldValue } from '../domain/validation';

export interface NewTaskInput {
	project: ProjectConfig;
	globalConfig: GlobalConfig;
	taskMetadataSettings: TaskMetadataSettings;
	title: string;
	taskTypeId: string;
	priority?: ProjectPriority;
	reporterId?: string;
	assigneeId: string | null;
	scheduledDate?: string | null;
	startDate: string | null;
	dueDate: string | null;
	endDate?: string | null;
	tags: string[];
	custom: Record<string, unknown>;
	body: string;
	links?: string;
	subtasks?: string;
	relations?: TaskRelation[];
	note?: string;
	noteAuthorId?: string;
}

export interface PreparedTask {
	path: string;
	nextNumber: number;
	document: TaskDocument;
}

export function applyTaskTemplate(
	currentBody: string,
	bodyEdited: boolean,
	template: string | null,
): string {
	return bodyEdited ? currentBody : (template ?? '');
}

export function switchTaskTypeDraft(
	drafts: Readonly<Record<string, string>>,
	currentTypeId: string,
	currentBody: string,
	nextTypeId: string,
	nextTemplate: string | null,
): { drafts: Record<string, string>; body: string } {
	const nextDrafts = { ...drafts, [currentTypeId]: currentBody };
	return {
		drafts: nextDrafts,
		body: nextDrafts[nextTypeId] ?? nextTemplate ?? '',
	};
}

export function switchTaskTypeFieldDrafts<T extends Record<string, unknown>>(
	drafts: Readonly<Record<string, T>>,
	currentTypeId: string,
	current: T,
	nextTypeId: string,
	nextDefaults: T,
): { drafts: Record<string, T>; values: T } {
	const nextDrafts = { ...drafts, [currentTypeId]: structuredClone(current) };
	return {
		drafts: nextDrafts,
		values: structuredClone(nextDrafts[nextTypeId] ?? nextDefaults),
	};
}

export function resolveTaskTypeTemplate(type: TaskTypeDefinition): string | null {
	return type.template;
}

export function prepareNewTask(
	input: NewTaskInput,
	existingKeys: ReadonlySet<string>,
	now = new Date(),
	uuidFactory = createUuid,
): PreparedTask {
	if (!input.project.active) throw new Error('停用项目不能新增任务。');
	const taskType = input.project.taskTypes.find(
		(type) => type.id === input.taskTypeId && type.active,
	);
	if (!taskType) throw new Error('任务类型不存在或已停用。');
	// 合并三个来源的 applicable custom fields：project.customFields + project.customFieldRefs + taskMetadataSettings.customFieldRefs
	const poolById = new Map((input.globalConfig.unifiedMetadataFields ?? []).map((f) => [f.id, f]));
	// 来源 A：旧版 project.customFields
	const applicableCustomFields = (input.project.customFields ?? []).filter((field) =>
		field.active && (!field.taskTypeIds || field.taskTypeIds.includes(input.taskTypeId)),
	);
	// 来源 B + C：customFieldRefs 引用的非内置字段（项目级 + 全局任务元数据级）
	const applicableUnifiedFields: UnifiedMetadataField[] = [];
	const seenUnifiedKeys = new Set<string>();
	for (const ref of input.project.customFieldRefs ?? []) {
		const unified = poolById.get(ref.unifiedMetadataFieldId);
		if (!unified || unified.isBuiltIn || seenUnifiedKeys.has(unified.key)) continue;
		const refTaskTypeIds = ref.taskTypeIds ?? [];
		if (refTaskTypeIds.length > 0 && !refTaskTypeIds.includes(input.taskTypeId)) continue;
		seenUnifiedKeys.add(unified.key);
		applicableUnifiedFields.push(unified);
	}
	for (const ref of input.taskMetadataSettings.customFieldRefs ?? []) {
		const unified = poolById.get(ref.unifiedMetadataFieldId);
		if (!unified || unified.isBuiltIn || seenUnifiedKeys.has(unified.key)) continue;
		seenUnifiedKeys.add(unified.key);
		applicableUnifiedFields.push(unified);
	}
	// 收集所有 applicable keys（去重）
	const applicableKeys = new Set<string>([
		...applicableCustomFields.map((f) => f.key),
		...applicableUnifiedFields.map((f) => f.key),
	]);
	// 构建 resolvedCustom，保留所有 applicable keys 中的非空值
	const resolvedCustom = Object.fromEntries(
		[...applicableKeys]
			.map((key) => {
				// 优先取 input.custom[key]，再回退到 field.default / unified.defaultValue
				const legacy = applicableCustomFields.find((f) => f.key === key);
				const unified = applicableUnifiedFields.find((f) => f.key === key);
				const fallback = legacy?.default ?? unified?.defaultValue;
				return [key, input.custom[key] ?? fallback] as const;
			})
			.filter(([, value]) => value !== null && value !== undefined && value !== ''),
	);
	// 验证：旧版字段使用 validateCustomFieldValue，新版字段类型若与旧版类型兼容也走相同验证
	const customIssues = applicableCustomFields.flatMap((field) =>
		validateCustomFieldValue(field, resolvedCustom[field.key]),
	);
	if (customIssues.length > 0) {
		throw new Error(customIssues.map((issue) => issue.message).join('\n'));
	}
	const prefix = `${input.project.code}-`;
	const highestExisting = Math.max(
		0,
		...[...existingKeys]
			.filter((key) => key.startsWith(prefix))
			.map((key) => Number(key.slice(prefix.length)))
			.filter(Number.isSafeInteger),
	);
	let number = Math.max(input.project.nextNumber, highestExisting + 1);
	let key = `${input.project.code}-${number}`;
	while (existingKeys.has(key)) {
		number += 1;
		key = `${input.project.code}-${number}`;
	}
	const month = localDate(now).slice(0, 7);
	const directory = input.project.groupByMonth
		? `${input.project.taskDirectory}/${month}`
		: input.project.taskDirectory;
	const body = input.body.trim().length > 0
		? input.body
		: (resolveTaskTypeTemplate(taskType) ?? '');
	const noteAuthorId = input.noteAuthorId ?? input.globalConfig.currentUserId;
	const author = input.globalConfig.people.find(
		(person) => person.id === noteAuthorId,
	);
	const note = input.note?.trim();
	return {
		path: `${directory}/${key}.md`,
		nextNumber: number + 1,
		document: {
			metadata: {
				kind: 'task',
				schema: 1,
				uid: uuidFactory(),
				key,
				projectUid: input.project.uid,
				title: input.title.trim(),
				taskTypeId: input.taskTypeId,
				priority: input.priority ?? 'medium',
				createdAt: localDateTime(now),
				scheduledDate: input.scheduledDate ?? null,
				startDate: input.startDate,
				dueDate: input.dueDate,
				endDate: input.endDate ?? null,
				completedAt: null,
				terminatedAt: null,
				reporterId: input.reporterId ?? input.globalConfig.currentUserId,
				assigneeId: input.assigneeId,
				statusId: input.project.workflow.initialStatusId,
				tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))],
				custom: resolvedCustom,
			},
			body,
			subtasks: input.subtasks?.trim() ?? '',
			relations: structuredClone(input.relations ?? []).filter((relation) => relation.type === 'related'),
			notes: note ? [{
				id: uuidFactory(),
				authorId: noteAuthorId,
				authorName: author?.name ?? '未知用户',
				createdAt: localDateTime(now),
				content: note,
			}] : [],
			unknownFrontmatter: {},
			unknownLinks: (input.links ?? '').split(/\r?\n/u).map((line) => line.trim()).filter(Boolean),
			lineEnding: '\n',
		},
	};
}
