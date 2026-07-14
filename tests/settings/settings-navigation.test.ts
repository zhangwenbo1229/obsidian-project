import { describe, expect, it } from 'vitest';
import { SETTINGS_PAGES, SettingsNavigation } from '../../src/settings/settings-navigation';

describe('settings navigation', () => {
	it('exposes the dedicated task template page', () => {
		expect(SETTINGS_PAGES).toContain('templates');
		expect(SETTINGS_PAGES).toContain('view-display');
	});

	it('opens project configuration inside settings and returns to the project list', () => {
		const navigation = new SettingsNavigation();
		expect(navigation.page).toBe('general');

		navigation.open('people');
		expect(navigation.page).toBe('people');
		navigation.open('templates');
		expect(navigation.page).toBe('templates');
		navigation.open('view-display');
		expect(navigation.page).toBe('view-display');

		navigation.openProject('project-uid');
		expect(navigation.page).toBe('project-detail');
		expect(navigation.selectedProjectUid).toBe('project-uid');

		navigation.backToProjects();
		expect(navigation.page).toBe('projects');
		expect(navigation.selectedProjectUid).toBe('');
	});
});
