import type { GlobalConfig, PersonalDashboardCardLayout, ProjectConfig, SavedProjectFilter, TagGroup, TagStyle, TaskConfigurationTemplate } from '../domain/types';
import { normalizeProjectViewDisplay, type ProjectViewDisplaySettings } from '../views/task-display-settings';
import { normalizePersonalDashboardSettings, type PersonalDashboardSettings } from '../views/personal-dashboard-settings';
import { isDashboardModuleKind, normalizeDashboardModuleConfig } from '../views/dashboard-modules/config';
import { normalizeTaskFieldConfig } from './task-field-configuration';
import { normalizeTaskMetadataSettings, type TaskMetadataSettings } from './task-metadata-settings';
import { normalizeCheckInHistory } from '../views/dashboard-modules/check-in-model';
import { normalizePeopleSourceSettings, type PeopleSourceSettings } from '../services/people-source';
import { normalizeNativeSidebarSettings, type NativeSidebarSettings } from './native-sidebar-settings';
import { normalizeGlobalPeopleConfig } from '../services/person-metadata';
import type { UnifiedMetadataField, PersonMetadataRef, ProjectTemplateMetadataRef } from '../domain/metadata-types';
import { BUILT_IN_FIELD_DEFINITIONS, builtInFieldId, ensureBuiltInFields } from '../domain/built-in-fields';
import { createUuid } from '../utils/ids';

export const CURRENT_CONFIGURATION_SCHEMA = 4;

export interface ConfigurationSnapshot {
	configurationSchema?: number;
	globalConfig: GlobalConfig;
	projects: ProjectConfig[];
	tagOrder: string[];
	tagStyles?: Record<string, TagStyle>;
	tagGroups?: TagGroup[];
	tagGroupAssignments?: Record<string, string>;
	taskTemplates?: TaskConfigurationTemplate[];
	savedProjectFilters?: SavedProjectFilter[];
	personalDashboardLayout?: PersonalDashboardCardLayout[];
	projectViewDisplay?: ProjectViewDisplaySettings;
	personalDashboardSettings?: PersonalDashboardSettings;
	taskMetadataSettings?: TaskMetadataSettings;
	peopleSourceSettings?: PeopleSourceSettings;
	nativeSidebarSettings?: NativeSidebarSettings;
}

export type NormalizedConfigurationSnapshot = ConfigurationSnapshot & {
	configurationSchema: number;
	taskTemplates: TaskConfigurationTemplate[];
	savedProjectFilters: SavedProjectFilter[];
	personalDashboardLayout: PersonalDashboardCardLayout[];
	tagStyles: Record<string, TagStyle>;
	tagGroups: TagGroup[];
	tagGroupAssignments: Record<string, string>;
	projectViewDisplay: ProjectViewDisplaySettings;
	personalDashboardSettings: PersonalDashboardSettings;
	taskMetadataSettings: TaskMetadataSettings;
	peopleSourceSettings: PeopleSourceSettings;
	nativeSidebarSettings: NativeSidebarSettings;
};

export function normalizeConfigurationSnapshot(
	snapshot: ConfigurationSnapshot,
): NormalizedConfigurationSnapshot {
	const configurationSchema = snapshot.configurationSchema ?? 1;
	if (configurationSchema > CURRENT_CONFIGURATION_SCHEMA) {
		throw new Error(`配置版本 ${configurationSchema} 高于当前支持版本 ${CURRENT_CONFIGURATION_SCHEMA}。`);
	}
	if (configurationSchema < 3) {
		migrateToUnifiedMetadata(snapshot);
	}
	if (configurationSchema < 4) {
		migrateBuiltInFieldsToRefs(snapshot);
	}
	const settingsSource = snapshot.personalDashboardSettings;
	const weatherCredentials = settingsSource?.weatherCredentials;
	const legacyWeatherCards = (snapshot.personalDashboardLayout ?? []).filter((card) => card.kind === 'weather');
	const qweather = legacyWeatherCards.find((card) => (card.moduleConfig as { provider?: string } | undefined)?.provider === 'qweather');
	const openWeatherMap = legacyWeatherCards.find((card) => (card.moduleConfig as { provider?: string } | undefined)?.provider === 'openweathermap');
	const qweatherLegacy = qweather?.moduleConfig as { apiKey?: unknown; apiHost?: unknown } | undefined;
	const openWeatherLegacy = openWeatherMap?.moduleConfig as { apiKey?: unknown } | undefined;
	let migratedPersonalSettings = normalizePersonalDashboardSettings({
		...settingsSource,
		weatherCredentials: {
			qweatherApiKey: weatherCredentials?.qweatherApiKey || qweatherLegacy?.apiKey,
			qweatherApiHost: weatherCredentials?.qweatherApiHost || qweatherLegacy?.apiHost,
			openWeatherMapApiKey: weatherCredentials?.openWeatherMapApiKey || openWeatherLegacy?.apiKey,
		},
	});
	const personalDashboardLayout = structuredClone(snapshot.personalDashboardLayout ?? []).map((card) => ({
		...card,
		moduleConfig: isDashboardModuleKind(card.kind)
			? normalizeDashboardModuleConfig(card.kind, card.moduleConfig)
			: card.moduleConfig,
	}));
	const firstCheckInCardId = personalDashboardLayout.find((card) => card.kind === 'check-in')?.id ?? null;
	const legacyCheckInHistory = normalizeCheckInHistory((settingsSource as unknown as { checkInHistory?: unknown } | undefined)?.checkInHistory);
	if (firstCheckInCardId && Object.keys(legacyCheckInHistory).length > 0 && !migratedPersonalSettings.checkInHistories[firstCheckInCardId]) {
		migratedPersonalSettings = {
			...migratedPersonalSettings,
			checkInHistories: { ...migratedPersonalSettings.checkInHistories, [firstCheckInCardId]: legacyCheckInHistory },
		};
	}
	for (const card of personalDashboardLayout) {
		if ((card.kind === 'calendar' || card.kind === 'heatmap') && firstCheckInCardId) {
			const config = card.moduleConfig as { useCheckInData?: boolean; checkInCardId?: string | null } | undefined;
			if (config?.useCheckInData && !config.checkInCardId) config.checkInCardId = firstCheckInCardId;
		}
	}
	const templateIdsByLegacyId = new Map<string, string[]>();
	const taskTemplates = (snapshot.taskTemplates ?? []).flatMap((template) => {
		const normalizedTemplate = {
			...structuredClone(template),
			taskTypes: template.taskTypes.map((type) => ({ ...structuredClone(type), fieldConfig: normalizeTaskFieldConfig(type.fieldConfig) })),
		};
		if (template.taskTypes.length <= 1) {
			templateIdsByLegacyId.set(template.id, [template.id]);
			return [normalizedTemplate];
		}
		const split = normalizedTemplate.taskTypes.map((taskType) => ({
			...structuredClone(normalizedTemplate),
			id: `${template.id}:${taskType.id}`,
			name: taskType.name,
			taskTypes: [structuredClone(taskType)],
		}));
		templateIdsByLegacyId.set(template.id, split.map((item) => item.id));
		return split;
	});
	const projects = snapshot.projects.map((project) => ({
		...structuredClone(project),
		taskTypes: project.taskTypes.map((type) => ({ ...structuredClone(type), fieldConfig: normalizeTaskFieldConfig(type.fieldConfig) })),
		templateIds: project.templateIds ?? (project.templateId ? templateIdsByLegacyId.get(project.templateId) ?? [project.templateId] : []),
	}));
	const customFields = [...new Map(projects.flatMap((project) => project.customFields ?? []).map((field) => [field.key, field])).values()];
	const result: NormalizedConfigurationSnapshot = {
		...structuredClone(snapshot),
		configurationSchema: CURRENT_CONFIGURATION_SCHEMA,
		globalConfig: {
			...normalizeGlobalPeopleConfig(snapshot.globalConfig),
			unifiedMetadataFields: ensureBuiltInFields(
				normalizeGlobalPeopleConfig(snapshot.globalConfig).unifiedMetadataFields ?? [],
			),
		},
		projects,
		tagOrder: [...(snapshot.tagOrder ?? [])],
		tagStyles: structuredClone(snapshot.tagStyles ?? {}),
		tagGroups: structuredClone(snapshot.tagGroups ?? []).map((group, order) => ({
			...group,
			name: group.name.trim(),
			order: Number.isFinite(group.order) ? group.order : order,
		})).filter((group) => group.id && group.name),
		tagGroupAssignments: structuredClone(snapshot.tagGroupAssignments ?? {}),
		taskTemplates,
		savedProjectFilters: structuredClone(snapshot.savedProjectFilters ?? []),
		personalDashboardLayout,
		personalDashboardSettings: migratedPersonalSettings,
		taskMetadataSettings: normalizeTaskMetadataSettings(snapshot.taskMetadataSettings),
		projectViewDisplay: normalizeProjectViewDisplay(snapshot.projectViewDisplay, customFields),
		peopleSourceSettings: normalizePeopleSourceSettings(snapshot.peopleSourceSettings),
		nativeSidebarSettings: normalizeNativeSidebarSettings(snapshot.nativeSidebarSettings),
	};

	return result;
}

export interface ConfigurationStore {
	load(): Promise<ConfigurationSnapshot | null>;
	save(snapshot: ConfigurationSnapshot): Promise<void>;
}

export interface LegacyConfiguration {
	snapshot: ConfigurationSnapshot;
	cleanup(): Promise<void>;
}

function migrateToUnifiedMetadata(snapshot: ConfigurationSnapshot): void {
	// schema < 3: 迁移三处元数据到统一元数据池
	const globalConfig = snapshot.globalConfig;
	const pool = new Map<string, UnifiedMetadataField>();
	const addToPool = (field: UnifiedMetadataField) => {
		const key = field.key.toLowerCase();
		if (!pool.has(key)) pool.set(key, field);
	};

	// 1. 迁移人员元数据
	const personFields = globalConfig.personMetadataFields ?? [];
	const personRefs: PersonMetadataRef[] = [];
	for (const field of personFields) {
		const unified: UnifiedMetadataField = {
			id: field.id,
			key: field.key,
			name: field.title,
			type: field.type as UnifiedMetadataField['type'],
			icon: field.icon ?? 'user',
			color: field.color ?? '#626f86',
			required: (field as any).required ?? false,
			defaultValue: null,
			options: (field.options ?? []).map((o) => ({ id: o.id, name: o.name })),
		};
		addToPool(unified);
		personRefs.push({ unifiedMetadataFieldId: unified.id, sourceProperty: field.sourceProperty });
	}

	// 2. 迁移任务元数据自定义字段
	const taskMeta = snapshot.taskMetadataSettings;
	if (taskMeta?.customFields) {
		for (const field of taskMeta.customFields) {
			addToPool({
				id: field.id,
				key: field.key,
				name: field.name,
				type: field.type as UnifiedMetadataField['type'],
				icon: field.icon,
				color: field.color,
				required: field.required,
				defaultValue: field.defaultValue,
				options: field.options?.map((o) => ({ id: o.id, name: o.name })),
			});
		}
	}

	// 3. 迁移项目模板自定义字段
	for (const project of snapshot.projects ?? []) {
		const migratedRefs: ProjectTemplateMetadataRef[] = [];
		for (const field of project.customFields ?? []) {
			const id = field.id ?? createUuid();
			addToPool({
				id,
				key: field.key,
				name: field.name,
				type: field.type as UnifiedMetadataField['type'],
				icon: field.icon ?? 'brackets',
				color: field.color ?? '#626f86',
				required: field.required ?? false,
				defaultValue: field.default ?? null,
				options: (field.options ?? []).map((o) => ({ id: o.id, name: o.name })),
			});
			migratedRefs.push({
				unifiedMetadataFieldId: id,
				taskTypeIds: (field as { taskTypeIds?: string[] }).taskTypeIds ?? [],
			});
		}
		(project as any)._migratedCustomFieldRefs = migratedRefs;
	}

	// 写入统一元数据池
	globalConfig.unifiedMetadataFields = [...pool.values()];
	globalConfig.personMetadataRefs = personRefs;
	// 清除旧数据
	globalConfig.personMetadataFields = [];
	if (taskMeta) taskMeta.customFields = [];
	// 清除项目模板旧自定义字段（保留引用）
	for (const project of snapshot.projects ?? []) {
		const refs = (project as any)._migratedCustomFieldRefs as ProjectTemplateMetadataRef[] | undefined;
		if (refs) {
			(project as any).customFieldRefs = refs;
			delete (project as any)._migratedCustomFieldRefs;
		}
		project.customFields = undefined;
	}
}

function migrateBuiltInFieldsToRefs(snapshot: ConfigurationSnapshot): void {
	// schema < 4: 将 taskType.fieldConfig 中启用的内置字段添加到 customFieldRefs 引用
	const builtInKeys = new Set(BUILT_IN_FIELD_DEFINITIONS.map((def) => def.key));
	for (const template of snapshot.taskTemplates ?? []) {
		const refs = template.customFieldRefs ?? [];
		const existingIds = new Set(refs.map((r) => r.unifiedMetadataFieldId));
		for (const taskType of template.taskTypes) {
			const fieldConfig = taskType.fieldConfig ?? {};
			for (const [fieldKey, rule] of Object.entries(fieldConfig)) {
				if (!builtInKeys.has(fieldKey)) continue;
				if (!rule?.enabled) continue;
				const id = builtInFieldId(fieldKey);
				if (existingIds.has(id)) continue;
				refs.push({ unifiedMetadataFieldId: id, taskTypeIds: [] });
				existingIds.add(id);
			}
		}
		template.customFieldRefs = refs;
	}
	for (const project of snapshot.projects ?? []) {
		const refs = project.customFieldRefs ?? [];
		const existingIds = new Set(refs.map((r) => r.unifiedMetadataFieldId));
		for (const taskType of project.taskTypes ?? []) {
			const fieldConfig = taskType.fieldConfig ?? {};
			for (const [fieldKey, rule] of Object.entries(fieldConfig)) {
				if (!builtInKeys.has(fieldKey)) continue;
				if (!rule?.enabled) continue;
				const id = builtInFieldId(fieldKey);
				if (existingIds.has(id)) continue;
				refs.push({ unifiedMetadataFieldId: id, taskTypeIds: [] });
				existingIds.add(id);
			}
		}
		project.customFieldRefs = refs;
	}
}

export async function loadOrMigrateConfiguration(
	store: ConfigurationStore,
	loadLegacy: () => Promise<LegacyConfiguration | null>,
): Promise<ConfigurationSnapshot> {
	const stored = await store.load();
	if (stored) {
		const normalized = normalizeConfigurationSnapshot(stored);
		if (JSON.stringify(stored) !== JSON.stringify(normalized)) await store.save(normalized);
		return normalized;
	}
	const legacy = await loadLegacy();
	if (!legacy) throw new Error('没有可用的配置数据。');
	const normalizedLegacy = normalizeConfigurationSnapshot(legacy.snapshot);
	await store.save(normalizedLegacy);
	const verified = await store.load();
	if (!verified || JSON.stringify(normalizeConfigurationSnapshot(verified)) !== JSON.stringify(normalizedLegacy)) {
		throw new Error('配置写入插件数据后校验失败，旧配置文件已保留。');
	}
	await legacy.cleanup();
	return normalizeConfigurationSnapshot(verified);
}
