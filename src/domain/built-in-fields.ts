import type { UnifiedMetadataField, UnifiedFieldType } from './metadata-types';

export interface BuiltInFieldDefinition {
	key: string;
	name: string;
	type: UnifiedFieldType;
	icon: string;
	color: string;
	defaultValue: unknown;
	options?: { id: string; name: string }[];
}

export const BUILT_IN_FIELD_DEFINITIONS: BuiltInFieldDefinition[] = [
	{
		key: 'title',
		name: '标题',
		type: 'text',
		icon: 'text',
		color: '#626f86',
		defaultValue: '',
	},
	{
		key: 'priority',
		name: '优先级',
		type: 'single-select',
		icon: 'flag',
		color: '#626f86',
		defaultValue: 'medium',
		options: [
			{ id: 'high', name: '高' },
			{ id: 'medium', name: '中' },
			{ id: 'low', name: '低' },
		],
	},
	{
		key: 'reporter',
		name: '提报人',
		type: 'user',
		icon: 'user',
		color: '#626f86',
		defaultValue: null,
	},
	{
		key: 'assignee',
		name: '经办人',
		type: 'user',
		icon: 'user-check',
		color: '#626f86',
		defaultValue: null,
	},
	{
		key: 'scheduledDate',
		name: '计划日期',
		type: 'date',
		icon: 'calendar-range',
		color: '#626f86',
		defaultValue: null,
	},
	{
		key: 'dueDate',
		name: '截止日期',
		type: 'date',
		icon: 'calendar-clock',
		color: '#626f86',
		defaultValue: null,
	},
	{
		key: 'startDate',
		name: '开始日期',
		type: 'date',
		icon: 'calendar-check',
		color: '#626f86',
		defaultValue: null,
	},
	{
		key: 'endDate',
		name: '结束日期',
		type: 'date',
		icon: 'calendar-x',
		color: '#626f86',
		defaultValue: null,
	},
	{
		key: 'tags',
		name: '标签',
		type: 'multi-select',
		icon: 'tags',
		color: '#626f86',
		defaultValue: [],
	},
	{
		key: 'links',
		name: '链接',
		type: 'text',
		icon: 'link',
		color: '#626f86',
		defaultValue: '',
	},
	{
		key: 'task',
		name: '任务',
		type: 'task-reference',
		icon: 'list-tree',
		color: '#626f86',
		defaultValue: null,
	},
	{
		key: 'relations',
		name: '项目关系',
		type: 'task-reference',
		icon: 'git-branch',
		color: '#626f86',
		defaultValue: null,
	},
	];

/** Built-in field IDs are deterministic: hash of the key */
export function builtInFieldId(key: string): string {
	// Use a simple deterministic hash
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		const char = key.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash |= 0;
	}
	// Convert to UUID-like format
	const hex = Math.abs(hash).toString(16).padStart(8, '0');
	return `builtin-${key}-${hex}`;
}

/** Ensure built-in fields exist in the unified metadata pool */
export function ensureBuiltInFields(existing: UnifiedMetadataField[]): UnifiedMetadataField[] {
	const result = [...existing];
	const existingKeys = new Set(result.map((f) => f.builtInKey ?? f.key));

	for (const def of BUILT_IN_FIELD_DEFINITIONS) {
		if (existingKeys.has(def.key)) continue;
		result.push({
			id: builtInFieldId(def.key),
			key: def.key,
			name: def.name,
			type: def.type,
			icon: def.icon,
			color: def.color,
			required: false,
			defaultValue: def.defaultValue,
			options: def.options ? structuredClone(def.options) : undefined,
			isBuiltIn: true,
			builtInKey: def.key,
		});
	}

	// 移除已废弃的内置字段（builtInKey 不在当前 BUILT_IN_FIELD_DEFINITIONS 中）
	const currentBuiltInKeys = new Set(BUILT_IN_FIELD_DEFINITIONS.map((def) => def.key));
	return result.filter((field) => {
		if (!field.isBuiltIn) return true;
		const key = field.builtInKey ?? field.key;
		return currentBuiltInKeys.has(key);
	});
}