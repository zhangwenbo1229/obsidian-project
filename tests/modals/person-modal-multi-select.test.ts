import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../src/modals/person-modal.ts', import.meta.url), 'utf8');

describe('person modal multi-select grouped tag picker', () => {
	it('imports renderGroupedTagPicker from grouped-tag-picker', () => {
		expect(source).toMatch(/renderGroupedTagPicker/u);
	});

	it('uses renderGroupedTagPicker for multi-select metadata fields', () => {
		// Verify multi-select case calls renderGroupedTagPicker with setting.controlEl
		expect(source).toMatch(/multi-select.*renderGroupedTagPicker/su);
	});
});