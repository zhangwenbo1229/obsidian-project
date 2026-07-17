import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const editorUrl = new URL('../../src/modals/markdown-editor.ts', import.meta.url);
const createSource = readFileSync(new URL('../../src/modals/create-task-modal.ts', import.meta.url), 'utf8');
const editSource = readFileSync(new URL('../../src/modals/edit-task-modal.ts', import.meta.url), 'utf8');

describe('live Markdown editor', () => {
	it('provides edit, preview, and split modes with debounced Obsidian rendering', () => {
		expect(existsSync(editorUrl)).toBe(true);
		if (existsSync(editorUrl)) {
			const source = readFileSync(editorUrl, 'utf8');
			expect(source).toContain("type MarkdownEditorMode = 'edit' | 'preview' | 'split'");
			expect(source).toContain('MarkdownRenderer.render');
			expect(source).toContain('200');
		}
	});

	it('uses the shared editor for task bodies and notes in create and edit dialogs', () => {
		expect(createSource.match(/\brenderMarkdownEditor\(/g)?.length).toBe(2);
		expect(editSource.match(/\brenderMarkdownEditor\(/g)?.length).toBe(3);
	});
});
