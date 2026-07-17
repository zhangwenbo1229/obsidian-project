import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
const tags = readFileSync(new URL('../../src/integrations/builtin-tag-editor.ts', import.meta.url), 'utf8');
const properties = readFileSync(new URL('../../src/integrations/builtin-property-editor.ts', import.meta.url), 'utf8');

describe('integration lifecycle boundaries', () => {
	it('observes only the workspace and clears the dashboard cache on unload', () => {
		expect(tags).toContain('observer?.observe(workspaceRoot');
		expect(properties).toContain('observer?.observe(workspaceRoot');
		expect(tags).not.toContain('observer?.observe(ownerDocument.body');
		expect(properties).not.toContain('observer?.observe(ownerDocument.body');
		expect(main).toContain('dashboardVaultCache.clear()');
	});
});
