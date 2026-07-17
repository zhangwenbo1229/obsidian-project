import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('native sidebar group actions', () => {
	it('always renders tag grouping and exposes create, edit and delete actions', () => {
		const source = readFileSync(new URL('../../src/integrations/builtin-tag-editor.ts', import.meta.url), 'utf8');
		expect(source).not.toContain('if (manager.tagGroups.length === 0)');
		expect(source).toContain("setTitle('新建标签分组')");
		expect(source).toContain("setTitle('编辑标签分组')");
		expect(source).toContain("setTitle('删除标签分组')");
		expect(source).toContain('manager.deleteTagGroup');
		expect(source).toContain('existingHeadings.length === grouped.length');
	});

	it('renders ungrouped properties and exposes create, edit and delete actions', () => {
		const source = readFileSync(new URL('../../src/integrations/builtin-property-editor.ts', import.meta.url), 'utf8');
		expect(source).toContain("name: '未分组'");
		expect(source).toContain("setTitle('新建属性分组')");
		expect(source).toContain("setTitle('编辑属性分组')");
		expect(source).toContain("setTitle('删除属性分组')");
		expect(source).toContain('onDeleteGroup');
		expect(source).not.toMatch(/setTitle\('删除属性分组'\)[\s\S]{0,120}setWarning/u);
		expect(source).toContain('appendNativePropertyMenuActions');
		expect(source).not.toContain('Menu.forEvent(event)');
	});
});
