import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../src/settings/unified-metadata-editor.ts', import.meta.url), 'utf8');

describe('unified metadata drag-and-drop sorting', () => {
	it('sets draggable attribute on non-built-in field cards', () => {
		expect(source).toMatch(/draggable/u);
	});

	it('adds drag handle icon for custom fields', () => {
		expect(source).toMatch(/op-unified-metadata-drag-handle/u);
	});

	it('handles dragstart, dragover, drop events', () => {
		expect(source).toMatch(/dragstart/u);
		expect(source).toMatch(/dragover/u);
		expect(source).toMatch(/drop/u);
	});

	it('reorders fields array on drop', () => {
		expect(source).toMatch(/splice/u);
		expect(source).toMatch(/hasUnsavedChanges\s*=\s*true/u);
	});

	it('does not make built-in fields draggable', () => {
		expect(source).toMatch(/isBuiltIn|!isBuiltIn/u);
	});

	it('passes index to renderFieldRow', () => {
		expect(source).toMatch(/index/u);
		expect(source).toMatch(/fields\.entries\(\)/u);
	});
});