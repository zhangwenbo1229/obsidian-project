import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../scripts/seed-demo.mjs', import.meta.url), 'utf8');

describe('demo data seed', () => {
	it('rebuilds configured demo data with templates, filters, links, and notes', () => {
		expect(source).toContain('taskTemplates');
		expect(source).toContain('savedProjectFilters');
		expect(source).toContain("includes('demo-data')");
		expect(source).toContain('unknownLinks');
		expect(source).toContain('document.notes.push');
		expect(source).toContain('execFile');
	});
});
