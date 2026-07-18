import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('person metadata configuration and editing', () => {
	it('uses metadata definitions for presentation instead of decorating people', () => {
		const settings = readFileSync(new URL('../../src/settings/settings-tab.ts', import.meta.url), 'utf8');
		const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
		expect(settings).toContain('PersonMetadataSettingsEditor');
		expect(settings).toContain('PersonModal');
		expect(settings).not.toContain('person.title');
		expect(settings).not.toContain('person.icon');
		expect(settings).not.toContain('person.color');
		expect(css).toContain('.op-person-metadata-field');
		expect(css).toContain('.op-person-field-button');
	});

	it('provides explicit presentation controls for the person name property', () => {
		const editor = readFileSync(new URL('../../src/settings/person-metadata-settings-editor.ts', import.meta.url), 'utf8');
		const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
		expect(editor).toContain('人员名称属性');
		expect(editor).toContain('savePersonNamePresentation');
		expect(main).toContain('personNamePresentation');
		expect(main).not.toContain('const primary =');
	});

	it('renders all supported metadata input types in the person modal', () => {
		const modal = readFileSync(new URL('../../src/modals/person-modal.ts', import.meta.url), 'utf8');
		for (const type of ['multiline-text', 'number', 'boolean', 'date', 'datetime', 'single-select', 'multi-select']) {
			expect(modal).toContain(`field.type === '${type}'`);
		}
		expect(modal).toContain('manager.savePerson');
	});

	it('persists people through the manager person-file workflow', () => {
		const manager = readFileSync(new URL('../../src/services/personnel-service.ts', import.meta.url), 'utf8');
		expect(manager).toContain('serializePersonMarkdown');
		expect(manager).toContain('personMarkdownPath');
		expect(manager).toContain('sourcePath');
		expect(manager).toContain('this.pm.vault.ensureFolder');
		expect(manager).toContain('this.pm.vault.create');
		expect(manager).toContain('refreshPeopleFromMetadata');
	});

	it('opens person editing from reporter and assignee card fields without activating the project card', () => {
		const cards = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');
		expect(cards).toContain('PersonModal');
		expect(cards).toContain('event.stopPropagation()');
		expect(cards).toContain('new PersonModal(manager, person).open()');
		expect(cards).toContain("field === 'reporter'");
		expect(cards).toContain("field === 'assignee'");
	});
});
