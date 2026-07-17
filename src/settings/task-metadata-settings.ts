export const TASK_METADATA_FIELDS = [
	'scheduledDate', 'dueDate', 'startDate', 'doneDate',
] as const;

export const TASK_METADATA_CUSTOM_FIELD_TYPES = [
	'text', 'multiline-text', 'number', 'boolean', 'date', 'single-select', 'multi-select',
] as const;

export type TaskMetadataDisplayField = typeof TASK_METADATA_FIELDS[number];
export type TaskMetadataCustomFieldType = typeof TASK_METADATA_CUSTOM_FIELD_TYPES[number];

export interface TaskMetadataOption {
	id: string;
	name: string;
}

export interface TaskMetadataFieldPresentation {
	enabled: boolean;
	icon: string;
	color: string;
	showInTaskView: boolean;
	showInProjectCards: boolean;
}

export interface TaskMetadataCustomFieldDefinition {
	id: string;
	key: string;
	name: string;
	type: TaskMetadataCustomFieldType;
	required: boolean;
	defaultValue: unknown;
	icon: string;
	color: string;
	showInTaskView: boolean;
	showInProjectCards: boolean;
	options?: TaskMetadataOption[];
}

export interface TaskMetadataSettings {
	fields: Record<TaskMetadataDisplayField, TaskMetadataFieldPresentation>;
	customFields: TaskMetadataCustomFieldDefinition[];
}

const DEFAULTS: Record<TaskMetadataDisplayField, Pick<TaskMetadataFieldPresentation, 'icon' | 'color'>> = {
	scheduledDate: { icon: 'calendar-range', color: '#0c66e4' },
	dueDate: { icon: 'calendar-clock', color: '#c9372c' },
	startDate: { icon: 'plane-takeoff', color: '#227d9b' },
	doneDate: { icon: 'circle-check', color: '#1f845a' },
};

const CUSTOM_TYPES = new Set<string>(TASK_METADATA_CUSTOM_FIELD_TYPES);
const CUSTOM_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/u;

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function color(value: unknown, fallback: string): string {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value.trim())
		? value.trim().toLowerCase()
		: fallback;
}

function normalizeOptions(value: unknown): TaskMetadataOption[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	return value.flatMap((entry) => {
		const source = record(entry);
		const id = typeof source.id === 'string' ? source.id.trim() : '';
		if (!id || seen.has(id)) return [];
		seen.add(id);
		return [{ id, name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : id }];
	});
}

function normalizeCustomFields(value: unknown): TaskMetadataCustomFieldDefinition[] {
	if (!Array.isArray(value)) return [];
	const keys = new Set<string>();
	return value.flatMap((entry) => {
		const source = record(entry);
		const key = typeof source.key === 'string' ? source.key.trim() : '';
		const normalizedKey = key.toLocaleLowerCase();
		const type = typeof source.type === 'string' && CUSTOM_TYPES.has(source.type)
			? source.type as TaskMetadataCustomFieldType
			: null;
		if (!CUSTOM_KEY.test(key) || keys.has(normalizedKey) || !type) return [];
		keys.add(normalizedKey);
		const field: TaskMetadataCustomFieldDefinition = {
			id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : key,
			key,
			name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : key,
			type,
			required: source.required === true,
			defaultValue: source.defaultValue ?? null,
			icon: typeof source.icon === 'string' && source.icon.trim() ? source.icon.trim() : 'brackets',
			color: color(source.color, '#626f86'),
			showInTaskView: source.showInTaskView !== false,
			showInProjectCards: source.showInProjectCards !== false,
		};
		if (type === 'single-select' || type === 'multi-select') field.options = normalizeOptions(source.options);
		return [field];
	});
}

export function normalizeTaskMetadataSettings(value?: unknown): TaskMetadataSettings {
	const source = record(value);
	const fields = record(source.fields);
	return {
		fields: Object.fromEntries(TASK_METADATA_FIELDS.map((field) => {
			const item = record(fields[field]);
			const fallback = DEFAULTS[field];
			return [field, {
				enabled: item.enabled !== false,
				icon: typeof item.icon === 'string' && item.icon.trim() ? item.icon.trim() : fallback.icon,
				color: color(item.color, fallback.color),
				showInTaskView: item.showInTaskView !== false,
				showInProjectCards: item.showInProjectCards !== false,
			}];
		})) as Record<TaskMetadataDisplayField, TaskMetadataFieldPresentation>,
		customFields: normalizeCustomFields(source.customFields),
	};
}
