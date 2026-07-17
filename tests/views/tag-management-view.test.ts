import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
const integrationUrl = new URL('../../src/integrations/builtin-tag-editor.ts', import.meta.url);
const nativeSidebarDomUrl = new URL('../../src/integrations/native-sidebar-dom.ts', import.meta.url);

describe('built-in Obsidian tag editor integration', () => {
	it('uses the built-in Tags pane instead of registering another sidebar', () => {
		expect(main).not.toContain('TAG_MANAGEMENT_VIEW_TYPE');
		expect(main).not.toContain('activateTagManagement');
		expect(main).toContain('registerBuiltinTagEditor');
		expect(existsSync(integrationUrl)).toBe(true);
		if (existsSync(integrationUrl)) {
			const source = readFileSync(integrationUrl, 'utf8');
			const nativeSidebarDom = readFileSync(nativeSidebarDomUrl, 'utf8');
			expect(nativeSidebarDom).toContain("'.tag-pane-tag'");
			expect(nativeSidebarDom).toContain("'.tag-pane-tag-text'");
			expect(source).toContain("'dblclick'");
			expect(source).toContain('renameTag');
			expect(source).toContain("'dragstart'");
			expect(source).toContain("'drop'");
			expect(source).toContain('reparentTagPath');
		}
	});
});
