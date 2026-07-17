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

export interface ConfigurationSnapshot {
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
	const customFields = [...new Map(projects.flatMap((project) => project.customFields).map((field) => [field.key, field])).values()];
	return {
		...structuredClone(snapshot),
		globalConfig: normalizeGlobalPeopleConfig(snapshot.globalConfig),
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
}

export interface ConfigurationStore {
	load(): Promise<ConfigurationSnapshot | null>;
	save(snapshot: ConfigurationSnapshot): Promise<void>;
}

export interface LegacyConfiguration {
	snapshot: ConfigurationSnapshot;
	cleanup(): Promise<void>;
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
