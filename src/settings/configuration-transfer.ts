import { validateGlobalConfig, validateProjectConfig } from '../domain/validation';
import { normalizeConfigurationSnapshot, type ConfigurationSnapshot, type NormalizedConfigurationSnapshot } from './configuration-store';

export const CONFIGURATION_EXPORT_FORMAT = 'obsidian-project-configuration';
export const CONFIGURATION_EXPORT_VERSION = 1;

export interface ConfigurationExportEnvelope {
	format: typeof CONFIGURATION_EXPORT_FORMAT;
	version: typeof CONFIGURATION_EXPORT_VERSION;
	exportedAt: string;
	configuration: NormalizedConfigurationSnapshot;
}

export interface ConfigurationImportSummary {
	projects: number;
	templates: number;
	savedFilters: number;
	dashboardCards: number;
	tagGroups: number;
}

export interface ParsedConfigurationImport {
	configuration: NormalizedConfigurationSnapshot;
	summary: ConfigurationImportSummary;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('配置文件结构无效。');
	return value as Record<string, unknown>;
}

export function serializeConfigurationExport(
	snapshot: ConfigurationSnapshot,
	now = new Date(),
	options: { includeSecrets?: boolean } = {},
): string {
	return JSON.stringify(createConfigurationExportEnvelope(snapshot, now, options), null, 2);
}

export function createConfigurationExportEnvelope(
	snapshot: ConfigurationSnapshot,
	now = new Date(),
	options: { includeSecrets?: boolean } = {},
): ConfigurationExportEnvelope {
	const configuration = normalizeConfigurationSnapshot(structuredClone(snapshot));
	if (!options.includeSecrets) {
		configuration.personalDashboardSettings.weatherCredentials.qweatherApiKey = '';
		configuration.personalDashboardSettings.weatherCredentials.openWeatherMapApiKey = '';
	}
	return {
		format: CONFIGURATION_EXPORT_FORMAT,
		version: CONFIGURATION_EXPORT_VERSION,
		exportedAt: now.toISOString(),
		configuration,
	};
}

export function parseConfigurationImport(source: string): ParsedConfigurationImport {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch {
		throw new Error('导入文件不是有效的 JSON。');
	}
	const envelope = record(parsed);
	if (envelope.format !== CONFIGURATION_EXPORT_FORMAT) throw new Error('不是 obsidian-project 配置导出文件。');
	if (envelope.version !== CONFIGURATION_EXPORT_VERSION) throw new Error(`不支持的配置版本：${String(envelope.version)}。`);
	const rawConfiguration = record(envelope.configuration) as unknown as ConfigurationSnapshot;
	if (!Array.isArray(rawConfiguration.projects)) throw new Error('配置中的项目列表无效。');
	if (!Array.isArray(rawConfiguration.tagOrder)) throw new Error('配置中的标签顺序无效。');
	const configuration = normalizeConfigurationSnapshot(structuredClone(rawConfiguration));
	const globalValidation = validateGlobalConfig(configuration.globalConfig);
	if (!globalValidation.success) throw new Error(globalValidation.issues.map((issue) => issue.message).join('\n'));
	const projectUids = new Set<string>();
	const projectCodes = new Set<string>();
	for (const project of configuration.projects) {
		const validation = validateProjectConfig(project);
		if (!validation.success) throw new Error(`${project.name || project.code || '项目'}：${validation.issues.map((issue) => issue.message).join('；')}`);
		if (projectUids.has(project.uid)) throw new Error(`项目 UUID 重复：${project.uid}`);
		if (projectCodes.has(project.code)) throw new Error(`项目代码重复：${project.code}`);
		projectUids.add(project.uid);
		projectCodes.add(project.code);
	}
	return {
		configuration,
		summary: {
			projects: configuration.projects.length,
			templates: configuration.taskTemplates.length,
			savedFilters: configuration.savedProjectFilters.length,
			dashboardCards: configuration.personalDashboardLayout.length,
			tagGroups: configuration.tagGroups.length,
		},
	};
}
