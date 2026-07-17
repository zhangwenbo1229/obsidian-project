import type {
	GlobalConfig,
	Person,
	PersonMetadataFieldDefinition,
	PersonMetadataFieldType,
	PersonNamePresentation,
} from '../domain/types';

export const PERSON_METADATA_FIELD_TYPES: readonly PersonMetadataFieldType[] = [
	'text', 'multiline-text', 'number', 'boolean', 'date', 'datetime', 'single-select', 'multi-select',
];

export function normalizePersonNamePresentation(value: unknown): PersonNamePresentation {
	const source = record(value);
	const normalizedColor = text(source.color).toLowerCase();
	return {
		title: text(source.title) || '人员名称',
		...(text(source.icon) ? { icon: text(source.icon) } : { icon: 'user-round' }),
		...(/^#[0-9a-f]{6}$/u.test(normalizedColor) ? { color: normalizedColor } : { color: '#0c66e4' }),
	};
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function scalarText(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
		? String(value).trim() : '';
}

function normalizedOptions(value: unknown): Array<{ id: string; name: string }> {
	if (!Array.isArray(value)) return [];
	return value.flatMap((candidate) => {
		const option = record(candidate);
		const id = text(option.id);
		const name = text(option.name);
		return id && name ? [{ id, name }] : [];
	});
}

export function normalizePersonMetadataFields(value: unknown): PersonMetadataFieldDefinition[] {
	if (!Array.isArray(value)) return [];
	const keys = new Set<string>();
	return value.flatMap((candidate, index) => {
		const field = record(candidate);
		const key = text(field.key);
		if (!key || keys.has(key)) return [];
		const type = PERSON_METADATA_FIELD_TYPES.includes(field.type as PersonMetadataFieldType)
			? field.type as PersonMetadataFieldType : 'text';
		keys.add(key);
		const options = normalizedOptions(field.options);
		const color = text(field.color).toLowerCase();
		return [{
			id: text(field.id) || `person-field-${index}`,
			key,
			title: text(field.title) || key,
			type,
			active: field.active !== false,
			...(text(field.sourceProperty) && text(field.sourceProperty) !== key ? { sourceProperty: text(field.sourceProperty) } : {}),
			...(text(field.icon) ? { icon: text(field.icon) } : {}),
			...(/^#[0-9a-f]{6}$/u.test(color) ? { color } : {}),
			...((type === 'single-select' || type === 'multi-select') && options.length > 0 ? { options } : {}),
		}];
	});
}

export function normalizePersonMetadataValue(field: PersonMetadataFieldDefinition, value: unknown): unknown {
	if (value === null || value === undefined || value === '') return undefined;
	if (field.type === 'number') {
		const number = typeof value === 'number' ? value : Number(scalarText(value));
		return Number.isFinite(number) ? number : undefined;
	}
	if (field.type === 'boolean') {
		if (typeof value === 'boolean') return value;
		const normalized = scalarText(value).toLowerCase();
		if (['true', '1', 'yes', '是'].includes(normalized)) return true;
		if (['false', '0', 'no', '否'].includes(normalized)) return false;
		return undefined;
	}
	if (field.type === 'multi-select') {
		const values = (Array.isArray(value) ? value : scalarText(value).split(/[,，]/u))
			.map(scalarText).filter(Boolean);
		return values.length > 0 ? [...new Set(values)] : undefined;
	}
	const normalized = scalarText(value);
	if (!normalized) return undefined;
	if (field.type === 'date') return /^\d{4}-\d{2}-\d{2}/u.test(normalized) ? normalized.slice(0, 10) : undefined;
	if (field.type === 'datetime') return /^\d{4}-\d{2}-\d{2}T/u.test(normalized) ? normalized : undefined;
	return normalized;
}

const LEGACY_FIELDS: PersonMetadataFieldDefinition[] = [
	{ id: 'legacy-person-title', key: 'title', title: '标题', type: 'text', active: true, icon: 'badge' },
	{ id: 'legacy-person-icon', key: 'icon', title: '图标', type: 'text', active: true, icon: 'shapes' },
	{ id: 'legacy-person-color', key: 'color', title: '颜色', type: 'text', active: true, icon: 'palette' },
];

export function normalizeGlobalPeopleConfig(config: GlobalConfig): GlobalConfig {
	const source = config as unknown as GlobalConfig & { personMetadataFields?: unknown };
	const people = source.people.map((person) => {
		const legacy = person as unknown as Person & { title?: unknown; icon?: unknown; color?: unknown };
		const metadata = { ...record(person.metadata) };
		for (const key of ['title', 'icon', 'color'] as const) {
			if (legacy[key] !== undefined && metadata[key] === undefined) metadata[key] = legacy[key];
		}
		const { title: _title, icon: _icon, color: _color, ...identity } = legacy;
		void _title; void _icon; void _color;
		return { ...identity, metadata };
	});
	const configured = normalizePersonMetadataFields(source.personMetadataFields);
	const legacyKeys = new Set<'title' | 'icon' | 'color'>(people
		.flatMap((person) => Object.keys(person.metadata ?? {}))
		.filter((key): key is 'title' | 'icon' | 'color' => key === 'title' || key === 'icon' || key === 'color'));
	const configuredKeys = new Set(configured.map((field) => field.key));
	const fields = [
		...configured,
		...LEGACY_FIELDS.filter((field) => legacyKeys.has(field.key as 'title' | 'icon' | 'color') && !configuredKeys.has(field.key)),
	];
	return {
		...config,
		people,
		personMetadataFields: fields,
		personNamePresentation: normalizePersonNamePresentation(source.personNamePresentation),
	};
}
