// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
	findNativePropertyMenu,
	findNativePropertyRows,
	findNativeTagRows,
	nativePropertyKeyFromRow,
	nativeTagTextFromRow,
} from '../../src/integrations/native-sidebar-dom';

function element(className: string, text?: string): HTMLElement {
	const result = document.createElementNS('http://www.w3.org/1999/xhtml', 'section');
	result.className = className;
	if (text) result.textContent = text;
	return result;
}

describe('native sidebar DOM compatibility', () => {
	it('finds current and fallback tag rows and their visible labels', () => {
		const current = element('tag-pane-tag');
		current.append(element('tag-pane-tag-text', 'feature'));
		const fallback = element('');
		fallback.dataset.tag = 'legacy';
		fallback.append(element('tree-item-inner-text', 'legacy'));
		document.body.replaceChildren(current, fallback);
		const rows = findNativeTagRows(document);
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => nativeTagTextFromRow(row)?.textContent)).toEqual(['feature', 'legacy']);
	});

	it('finds current and fallback property rows and keys without throwing on unknown markup', () => {
		const current = element('metadata-property');
		current.dataset.propertyKey = 'status';
		const fallbackContainer = element('');
		fallbackContainer.dataset.type = 'all-properties';
		const fallback = element('tree-item-self');
		fallback.append(element('tree-item-inner-text', 'owner'));
		fallbackContainer.append(fallback);
		const unknown = element('unknown', 'ignored');
		document.body.replaceChildren(current, fallbackContainer, unknown);
		const rows = findNativePropertyRows(document);
		expect(rows.map(nativePropertyKeyFromRow)).toEqual(['status', 'owner']);
		expect(nativePropertyKeyFromRow(unknown)).toBe('');
	});

	it('locates the native property menu semantically and returns its action group', () => {
		const menu = element('menu');
		for (const title of ['重命名', '删除属性']) {
			const group = element('menu-group');
			group.append(element('menu-item-title', title));
			menu.append(group);
		}
		document.body.replaceChildren(menu);
		const result = findNativePropertyMenu(document);
		expect(result?.menu).toBe(menu);
		expect(result?.actionGroup.textContent).toContain('重命名');
		const unrelated = element('menu', '其他菜单');
		document.body.replaceChildren(unrelated);
		expect(findNativePropertyMenu(document)).toBeNull();
	});
});
