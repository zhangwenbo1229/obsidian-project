import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	DASHBOARD_MODULE_DEFINITIONS,
	getDashboardModuleDefinition,
} from '../../src/views/dashboard-modules/registry';

describe('personal dashboard module registry', () => {
	it('registers render and settings handlers for every module kind', () => {
		expect(DASHBOARD_MODULE_DEFINITIONS.map((item) => item.kind)).toEqual([
			'weather', 'calendar', 'date', 'todo', 'note-stats', 'recent-files', 'news', 'directory', 'text', 'chart',
			'countdown', 'progress', 'check-in', 'heatmap', 'iframe',
		]);
		for (const definition of DASHBOARD_MODULE_DEFINITIONS) {
			expect(typeof definition.render).toBe('function');
			expect(typeof definition.renderSettings).toBe('function');
			expect(getDashboardModuleDefinition(definition.kind)).toBe(definition);
		}
	});

	it('dispatches module cards from the workspace menu and settings modal', () => {
		const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
		const modal = readFileSync(new URL('../../src/modals/dashboard-card-settings-modal.ts', import.meta.url), 'utf8');
		expect(personal).toContain('DASHBOARD_MODULE_DEFINITIONS');
		expect(personal).toContain('getDashboardModuleDefinition');
		expect(personal).toContain('definition.render');
		expect(modal).toContain('definition.renderSettings');
		expect(modal).toContain('moduleConfig');
	});
});
