export const PROJECT_FILTER_FIELD_DEFINITIONS = [
	{ field: 'status', pickerLabel: '状态', controlLabel: '状态', kind: 'multi' },
	{ field: 'statusCategory', pickerLabel: '状态分类', controlLabel: '状态分类', kind: 'multi' },
	{ field: 'type', pickerLabel: '任务类型', controlLabel: '任务类型', kind: 'multi' },
	{ field: 'reporter', pickerLabel: '提报人', controlLabel: '提报人', kind: 'multi' },
	{ field: 'assignee', pickerLabel: '经办人', controlLabel: '经办人', kind: 'multi' },
	{ field: 'tags', pickerLabel: '标签', controlLabel: '标签', kind: 'multi' },
	{ field: 'createdAt', pickerLabel: '创建日期', controlLabel: '创建日期', kind: 'date-range' },
	{ field: 'scheduledDate', pickerLabel: '计划日期', controlLabel: '计划日期', kind: 'date-range' },
	{ field: 'dueDate', pickerLabel: '截止日期', controlLabel: '截止日期', kind: 'date-range' },
	{ field: 'startDate', pickerLabel: '开始日期', controlLabel: '开始日期', kind: 'date-range' },
	{ field: 'endDate', pickerLabel: '结束日期', controlLabel: '结束日期', kind: 'date-range' },
	{ field: 'completedAt', pickerLabel: '完成日期', controlLabel: '完成日期', kind: 'date-range' },
	{ field: 'subtasks', pickerLabel: '未完成子任务', controlLabel: '未完成子任务', kind: 'boolean' },
	{ field: 'customFields', pickerLabel: '自定义字段', controlLabel: '自定义字段', kind: 'custom' },
] as const;

export type ProjectFilterField = typeof PROJECT_FILTER_FIELD_DEFINITIONS[number]['field'];
export const PROJECT_FILTER_FIELDS = PROJECT_FILTER_FIELD_DEFINITIONS.map((definition) => definition.field);

export function projectFilterFieldDefinition(field: ProjectFilterField) {
	return PROJECT_FILTER_FIELD_DEFINITIONS.find((definition) => definition.field === field)!;
}

export class ProjectFilterFields {
	private readonly active = new Set<ProjectFilterField>();

	toggle(field: ProjectFilterField): void {
		if (this.active.has(field)) this.active.delete(field);
		else this.active.add(field);
	}

	has(field: ProjectFilterField): boolean { return this.active.has(field); }
	remove(field: ProjectFilterField): void { this.active.delete(field); }
	selected(): ProjectFilterField[] { return PROJECT_FILTER_FIELDS.filter((field) => this.active.has(field)); }
	clear(): void { this.active.clear(); }
}
