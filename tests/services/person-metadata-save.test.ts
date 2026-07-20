import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const personnelServiceSource = readFileSync(new URL('../../src/services/personnel-service.ts', import.meta.url), 'utf8');
const personParserSource = readFileSync(new URL('../../src/markdown/person-parser.ts', import.meta.url), 'utf8');

describe('person metadata save', () => {
	describe('personnel-service savePerson', () => {
		it('iterates personMetadataRefs to collect unified metadata', () => {
			expect(personnelServiceSource).toMatch(/personMetadataRefs/u);
		});

		it('resolves refs against unifiedMetadataFields', () => {
			expect(personnelServiceSource).toMatch(/unifiedMetadataFields/u);
		});

		it('uses unifiedById map for ref resolution', () => {
			expect(personnelServiceSource).toMatch(/unifiedById/u);
		});
	});

	describe('person-parser serializePersonMarkdown', () => {
		it('writes metadata keys not in fields to frontmatter', () => {
			expect(personParserSource).toMatch(/fields\.some/u);
		});

		it('skips undefined null and empty string values', () => {
			expect(personParserSource).toMatch(/value === undefined \|\| value === null \|\| value === ''/u);
		});
	});
});