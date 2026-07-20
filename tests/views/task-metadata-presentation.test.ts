import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../src/views/task-metadata-presentation.ts', import.meta.url), 'utf8');

describe('renderTaskMetadata unified refs', () => {
	it('iterates taskMetadataSettings.customFieldRefs so user-configured metadata appears in task view and project cards', () => {
		// Bug: previously only customFields (legacy) was iterated; customFieldRefs (new) was ignored
		expect(source).toMatch(/customFieldRefs/u);
		expect(source).toMatch(/unifiedMetadataFields/u);
	});

	it('respects showInTaskView and showInProjectCards visibility flags on each ref', () => {
		expect(source).toMatch(/showInTaskView/u);
		expect(source).toMatch(/showInProjectCards/u);
	});
});
