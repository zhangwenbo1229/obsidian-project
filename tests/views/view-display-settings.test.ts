import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as displaySettings from '../../src/views/task-display-settings';

const modelUrl = new URL('../../src/views/task-display-settings.ts', import.meta.url);
const editorUrl = new URL('../../src/settings/view-display-editor.ts', import.meta.url);
const settings = readFileSync(new URL('../../src/settings/settings-tab.ts', import.meta.url), 'utf8');
const project = readFileSync(new URL('../../src/views/project-view.ts', import.meta.url), 'utf8');
const cardFields = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');

describe('project view display settings', () => {
	it('provides shared fields and a dedicated four-mode settings page', () => {
		expect(existsSync(modelUrl)).toBe(true);
		expect(existsSync(editorUrl)).toBe(true);
		if (existsSync(modelUrl)) {
			const source = readFileSync(modelUrl, 'utf8');
			expect(source).toContain('DEFAULT_PROJECT_VIEW_DISPLAY');
			expect(source).toContain('TASK_DISPLAY_FIELD_LABELS');
		}
		if (existsSync(editorUrl)) {
			const source = readFileSync(editorUrl, 'utf8');
			for (const mode of ['list', 'board', 'calendar', 'quadrants']) expect(source).toContain(mode);
		}
		expect(settings).toContain("'视图显示'");
		expect(settings).toContain('ViewDisplaySettingsEditor');
	});

	it('applies independently configured fields in every project mode', () => {
		for (const mode of ['list', 'board', 'calendar', 'quadrants']) {
			expect(project).toContain(`displayFields('${mode}')`);
		}
		expect(cardFields).toContain("field === 'tags'");
		expect(cardFields).toContain("field === 'priority'");
		expect(cardFields).toContain("field === 'relations'");
		expect(cardFields).toContain("field === 'links'");
		expect(cardFields).toContain("field === 'subtasks'");
	});

	it('uses four subpages and draggable ordered field rows', () => {
		const editor = readFileSync(editorUrl, 'utf8');
		const sortable = readFileSync(new URL('../../src/settings/sortable-display-fields.ts', import.meta.url), 'utf8');
		expect(editor).toContain('activeMode');
		expect(editor).toContain('op-view-display-tabs');
		expect(editor).toContain('SortableDisplayFields');
		expect(sortable).toContain('draggable');
	});

	it('exposes custom fields as independently configurable display entries', () => {
		const catalog = (displaySettings as Record<string, unknown>).taskDisplayFieldCatalog as undefined | ((
			fields: Array<{ key: string; name: string }>,
		) => Array<{ id: string; label: string }>);
		const label = (displaySettings as Record<string, unknown>).taskDisplayFieldLabel as undefined | ((
			field: string, customFields: Array<{ key: string; name: string }>,
		) => string);
		expect(typeof catalog).toBe('function');
		expect(typeof label).toBe('function');
		if (!catalog || !label) return;
		expect(catalog([{ key: 'review-at', name: '评审时间' }])).toContainEqual({ id: 'custom:review-at', label: '评审时间' });
		expect(label('custom:review-at', [{ key: 'review-at', name: '评审时间' }])).toBe('评审时间');
	});

	it('expands the legacy aggregate custom field at the same configured position', () => {
		const normalized = displaySettings.normalizeProjectViewDisplay({
			list: ['key', 'customFields', 'title'],
		}, [{ key: 'review-at', name: '评审时间' }, { key: 'risk', name: '风险' }] as never[]);
		expect(normalized.list).toEqual(['key', 'custom:review-at', 'custom:risk', 'title']);
	});
});
