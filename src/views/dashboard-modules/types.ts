import type { DashboardModuleConfig, DashboardModuleKind, PersonalDashboardCardLayout } from '../../domain/types';
import type { ProjectManager } from '../../services/project-manager';

export interface DashboardModuleRenderContext {
	container: HTMLElement;
	heading: HTMLElement;
	card: PersonalDashboardCardLayout;
	manager: ProjectManager;
	refresh: () => void;
	isCurrent: () => boolean;
}

export interface DashboardModuleSettingsContext {
	container: HTMLElement;
	config: DashboardModuleConfig;
	update: (config: DashboardModuleConfig) => void;
}

export interface DashboardModuleDefinition {
	kind: DashboardModuleKind;
	label: string;
	icon: string;
	render(context: DashboardModuleRenderContext): void | Promise<void>;
	renderSettings(context: DashboardModuleSettingsContext): void;
}
