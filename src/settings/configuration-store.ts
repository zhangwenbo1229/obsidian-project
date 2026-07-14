import type { GlobalConfig, PersonalDashboardCardLayout, ProjectConfig, SavedProjectFilter, TagGroup, TagStyle, TaskConfigurationTemplate } from '../domain/types';
import { normalizeProjectViewDisplay, type ProjectViewDisplaySettings } from '../views/task-display-settings';
import { normalizePersonalDashboardSettings, type PersonalDashboardSettings } from '../views/personal-dashboard-settings';
import { normalizeTaskFieldConfig } from './task-field-configuration';

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
};

export function normalizeConfigurationSnapshot(
	snapshot: ConfigurationSnapshot,
): NormalizedConfigurationSnapshot {
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
		personalDashboardLayout: structuredClone(snapshot.personalDashboardLayout ?? []),
		personalDashboardSettings: normalizePersonalDashboardSettings(snapshot.personalDashboardSettings),
		projectViewDisplay: normalizeProjectViewDisplay(snapshot.projectViewDisplay, customFields),
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
