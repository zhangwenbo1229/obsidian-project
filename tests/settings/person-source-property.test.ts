import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../src/settings/person-metadata-settings-editor.ts', import.meta.url), 'utf8');

describe('person metadata sourceProperty default', () => {
	it('sets sourceProperty to field key when adding a ref', () => {
		// Fix: sourceProperty should default to the metadata field's key value
		expect(source).toMatch(/sourceProperty:\s*field\.key/u);
	});
});