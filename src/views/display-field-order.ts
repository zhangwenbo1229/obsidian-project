import type { TaskDisplayField } from '../domain/types';

export function reorderTaskDisplayFields(
	fields: readonly TaskDisplayField[],
	dragged: TaskDisplayField,
	target: TaskDisplayField,
): TaskDisplayField[] {
	if (dragged === target || !fields.includes(dragged) || !fields.includes(target)) return [...fields];
	const next = fields.filter((field) => field !== dragged);
	const targetIndex = next.indexOf(target);
	next.splice(targetIndex < 0 ? next.length : targetIndex, 0, dragged);
	return next;
}
