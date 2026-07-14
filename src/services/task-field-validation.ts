import type { TaskFormField, TaskTypeDefinition } from '../domain/types';
import { taskFieldEnabled, taskFieldRequired, TASK_FORM_FIELD_LABELS } from '../settings/task-field-configuration';

function empty(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'string') return value.trim().length === 0;
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

export function validateConfiguredTaskFields(
	type: TaskTypeDefinition | undefined,
	values: Partial<Record<TaskFormField, unknown>>,
): string[] {
	return (Object.keys(values) as TaskFormField[]).flatMap((field) =>
		taskFieldEnabled(type, field) && taskFieldRequired(type, field) && empty(values[field])
			? [`${TASK_FORM_FIELD_LABELS[field]}为必填字段。`]
			: [],
	);
}
