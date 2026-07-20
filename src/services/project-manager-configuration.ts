import type { ProjectConfig } from '../domain/types';
import { normalizeConfigurationSnapshot, type ConfigurationSnapshot, type NormalizedConfigurationSnapshot } from '../settings/configuration-store';

export function configurationCustomFields(projects: readonly ProjectConfig[]) {
	return [...new Map(projects.flatMap((project) => project.customFields ?? []).map((field) => [field.key, field])).values()];
}

export function configurationWorkflowStatuses(projects: readonly ProjectConfig[]) {
	return [...new Map(projects.flatMap((project) => project.workflow.statuses).map((status) => [status.id, status])).values()];
}

export function createProjectManagerConfigurationSnapshot(
	state: ConfigurationSnapshot,
): NormalizedConfigurationSnapshot {
	return normalizeConfigurationSnapshot(structuredClone(state));
}
