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
		expect(source).toContain('scheduledDate');
		expect(source).toContain('endDate');
		expect(source).toContain('🆔 demo-');
		expect(source).toContain('document.subtasks');
		expect(source).toContain('execFile');
	});

	it('seeds several people with typed metadata definitions and values', () => {
		expect(source).toContain('personMetadataFields');
		expect(source).toContain("type: 'number'");
		expect(source).toContain("type: 'boolean'");
		expect(source).toContain("type: 'multi-select'");
		expect(source).toContain("name: '产品负责人'");
		expect(source).toContain("name: '开发负责人'");
		expect(source).toContain("name: '设计负责人'");
		expect(source).toContain('metadata:');
	});
});
