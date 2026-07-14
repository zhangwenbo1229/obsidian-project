import type { CustomFieldDefinition, Person } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { displayDateTime } from '../utils/dates';

function primitiveValue(value: unknown): string {
	if (value === null || value === undefined || value === '') return '';
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
	return '';
}

export function formatCustomFieldValue(
	field: CustomFieldDefinition,
	value: unknown,
	people: readonly Person[] = [],
): string {
	if (Array.isArray(value)) {
		return value.map((item) => formatCustomFieldValue(field, item, people)).filter(Boolean).join(', ');
	}
	const raw = primitiveValue(value);
	if (!raw) return '';
	if (field.type === 'date') return raw.slice(0, 10);
	if (field.type === 'datetime') return displayDateTime(raw);
	if (field.type === 'single-select' || field.type === 'multi-select') {
		return field.options?.find((option) => option.id === raw)?.name ?? raw;
	}
	if (field.type === 'user') return people.find((person) => person.id === raw)?.name ?? raw;
	return raw;
}

export function formatTaskCustomFields(task: IndexedTask, manager: ProjectManager): string {
	const values = task.document.metadata.custom;
	const configured = task.project.customFields
		.filter((field) => Object.prototype.hasOwnProperty.call(values, field.key))
		.map((field) => formatCustomFieldValue(field, values[field.key], manager.globalConfig.people))
		.filter(Boolean);
	const known = new Set(task.project.customFields.map((field) => field.key));
	const unknown = Object.entries(values)
		.filter(([key]) => !known.has(key))
		.map(([, value]) => Array.isArray(value) ? value.map(primitiveValue).filter(Boolean).join(', ') : primitiveValue(value))
		.filter(Boolean);
	return [...configured, ...unknown].join(' · ');
}
