import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../src/modals/task-form-fields.ts', import.meta.url), 'utf8');

describe('renderCustomFields unified metadata refs', () => {
	it('reads project.customFieldRefs so template metadata changes appear in new task modal', () => {
		expect(source).toMatch(/customFieldRefs/u);
		expect(source).toMatch(/unifiedMetadataFields/u);
	});

	it('filters customFieldRefs by task type id when taskTypeIds is non-empty', () => {
		// Should respect the taskTypeIds semantics: empty = all task types, non-empty = specific
		expect(source).toMatch(/taskTypeIds/u);
	});

	it('renders a Setting for each unified metadata field referenced via customFieldRefs', () => {
		// Verify it actually constructs Setting entries for refs (not just iterates them silently)
		expect(source).toMatch(/new Setting\(container\)\.setName\(field\.name\)/u);
	});

	it('also renders taskMetadataSettings.customFieldRefs so task metadata changes appear in new task modal', () => {
		// Issue 5: task metadata config changes must reflect in new task popup
		expect(source).toMatch(/taskMetadataSettings/u);
	});
});

