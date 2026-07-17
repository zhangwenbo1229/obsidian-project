import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('structured subtask presentation', () => {
	it('uses dedicated create and edit dialogs with metadata controls', () => {
		const create = readFileSync(new URL('../../src/modals/create-subtask-modal.ts', import.meta.url), 'utf8');
		const edit = readFileSync(new URL('../../src/modals/edit-subtask-modal.ts', import.meta.url), 'utf8');
		for (const source of [create, edit]) {
			expect(source).toContain('计划日期');
			expect(source).toContain('截止日期');
			expect(source).toContain('renderGroupedTagPicker');
			expect(source).toContain('priority');
			expect(source).not.toContain('assigneeId');
		}
	});

	it('renders structured items separately from legacy Markdown', () => {
		const renderer = readFileSync(new URL('../../src/views/embedded-subtask-presentation.ts', import.meta.url), 'utf8');
		expect(renderer).toContain('parseEmbeddedSubtasks');
		expect(renderer).toContain('toggleEmbeddedSubtask');
		expect(renderer).toContain('EditSubtaskModal');
		expect(renderer).toContain('legacyMarkdown');
	});

	it('keeps task buttons left aligned and shadowless inside project cards', () => {
		expect(css).toMatch(/\.op-embedded-subtask-content\s*\{[^}]*justify-content:\s*stretch[^}]*justify-items:\s*start/u);
		expect(css).toMatch(/\.op-embedded-subtask-content\s*\{[^}]*box-shadow:\s*none\s*!important/u);
	});

	it('keeps task content and metadata on separate responsive rows without an opaque background', () => {
		const renderer = readFileSync(new URL('../../src/views/embedded-subtask-presentation.ts', import.meta.url), 'utf8');
		expect(css).toMatch(/\.op-embedded-subtask-content\s*\{[^}]*max-width:\s*100%[^}]*overflow:\s*visible/u);
		expect(css).toMatch(/\.op-embedded-subtask-content\s*\{[^}]*display:\s*grid/u);
		expect(css).toMatch(/\.op-embedded-subtask-title\s*\{[^}]*white-space:\s*normal/u);
		expect(css).toMatch(/\.op-embedded-subtask \.op-task-metadata\s*\{[^}]*grid-row:\s*2/u);
		expect(renderer).toContain('event.stopPropagation()');
	});
});
