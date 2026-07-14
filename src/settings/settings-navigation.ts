export const SETTINGS_PAGES = ['general', 'people', 'templates', 'projects', 'personal-dashboard', 'view-display'] as const;
export type SettingsRootPage = typeof SETTINGS_PAGES[number];
export type SettingsPage = SettingsRootPage | 'project-detail';

export class SettingsNavigation {
	page: SettingsPage = 'general';
	selectedProjectUid = '';

	open(page: SettingsRootPage): void {
		this.page = page;
		this.selectedProjectUid = '';
	}

	openProject(projectUid: string): void {
		this.page = 'project-detail';
		this.selectedProjectUid = projectUid;
	}

	backToProjects(): void {
		this.open('projects');
	}
}
