// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { appendNativePropertyMenuActions, collectNativePropertyRows, nativePropertyGroupAnchor, nativePropertyKey, propertyGroupEntries, renderNativePropertyGroups } from '../../src/integrations/builtin-property-editor';
import * as propertyEditor from '../../src/integrations/builtin-property-editor';
import { normalizeNativeSidebarSettings } from '../../src/settings/native-sidebar-settings';

describe('native property and tag sidebar integration', () => {
	it('appends plugin property actions directly to the native property menu shell', () => {
		const parsed = new DOMParser().parseFromString(`
			<div class="menu"><div class="menu-scroll"><div class="menu-group"><button class="menu-item">重命名</button></div><div class="menu-separator"></div><div class="menu-group"><button class="menu-item">删除属性</button></div></div></div>
		`, 'text/html');
		const edit = vi.fn();
		const createGroup = vi.fn();
		expect(appendNativePropertyMenuActions(parsed, edit, createGroup)).toBe(true);
		const menus = parsed.querySelectorAll('.menu');
		expect(menus).toHaveLength(1);
		expect(menus[0]?.textContent).toContain('删除属性');
		expect(menus[0]?.textContent).toContain('编辑属性样式与分组');
		expect(menus[0]?.textContent).toContain('新建属性分组');
		const editItem = Array.from(menus[0]!.querySelectorAll<HTMLElement>('.menu-item')).find((item) => item.textContent?.includes('编辑属性样式与分组'));
		editItem?.click();
		expect(edit).toHaveBeenCalledOnce();
	});
	it('indents property rows beneath their group heading like a tree', () => {
		const css = readFileSync('styles.css', 'utf8');
		expect(css).toMatch(/\.op-property-group-members\s*\{[^}]*padding-inline-start:\s*(?:12|14|16)px[^}]*border-inline-start:/u);
	});
	it('enables both native sidebar integrations by default', () => {
		expect(normalizeNativeSidebarSettings()).toMatchObject({ tagsEnabled: true, propertiesEnabled: true });
	});
	it('normalizes independent switches and property presentation', () => {
		expect(normalizeNativeSidebarSettings({
			tagsEnabled: false, propertiesEnabled: true,
			propertyGroups: [{ id: 'basic', name: '基础', order: 3, color: '#AABBCC', icon: 'list' }],
			propertyStyles: { status: { color: '#00AA55', icon: 'circle-check', groupId: 'basic' } },
		})).toMatchObject({
			tagsEnabled: false, propertiesEnabled: true,
			propertyGroups: [{ id: 'basic', name: '基础', order: 3, color: '#aabbcc', icon: 'list' }],
			propertyStyles: { status: { color: '#00aa55', icon: 'circle-check', groupId: 'basic' } },
		});
	});

	it('recognizes rows from both the all-properties sidebar and note property editor', () => {
		const parsed = new DOMParser().parseFromString(`
			<div class="workspace-leaf-content" data-type="all-properties">
				<div class="tree-item"><div class="tree-item-self"><div class="tree-item-inner-text">status</div></div></div>
			</div>
			<div class="metadata-property" data-property-key="owner"></div>
			<div class="workspace-leaf-content" data-type="file-explorer">
				<div class="tree-item-self"><div class="tree-item-inner-text">not-a-property</div></div>
			</div>
		`, 'text/html');
		const rows = collectNativePropertyRows(parsed);
		expect(rows.map((row) => nativePropertyKey(row))).toEqual(['status', 'owner']);
		expect(nativePropertyGroupAnchor(rows[0]!)).toBe(rows[0]!.closest('.tree-item'));
		expect(nativePropertyGroupAnchor(rows[1]!)).toBe(rows[1]);
	});

	it('groups only rows belonging to the all-properties sidebar', () => {
		const parsed = new DOMParser().parseFromString(`
			<div data-type="all-properties"><div class="tree-item"><div class="tree-item-self"><span class="tree-item-inner-text">status</span></div></div></div>
			<div class="metadata-property" data-property-key="owner"></div>
		`, 'text/html');
		const rows = collectNativePropertyRows(parsed);
		const isSidebarRow = (propertyEditor as unknown as { isNativePropertySidebarRow?: (row: HTMLElement) => boolean }).isNativePropertySidebarRow;
		expect(typeof isSidebarRow).toBe('function');
		expect(rows.filter((row) => isSidebarRow?.(row)).map((row) => nativePropertyKey(row))).toEqual(['status']);
	});

	it('orders configured property groups before the implicit ungrouped section', () => {
		const fixture = new DOMParser().parseFromString('<div></div><div></div><div></div>', 'text/html');
		const rows = ['owner', 'status', 'priority'].map((key, index) => ({ row: fixture.querySelectorAll<HTMLElement>('div')[index]!, key }));
		const groups = propertyGroupEntries(rows, {
			propertyGroups: [{ id: 'work', name: '工作', order: 0 }],
			propertyStyles: { status: { groupId: 'work' }, priority: { groupId: 'missing' } },
			tagsEnabled: true, propertiesEnabled: true,
		});
		expect(groups.map((group) => [group.name, group.members.map((member) => member.key)])).toEqual([
			['工作', ['status']], ['未分组', ['owner', 'priority']],
		]);
	});

	it('keeps configured property groups visible before any property is assigned', () => {
		const fixture = new DOMParser().parseFromString('<div></div>', 'text/html');
		const row = fixture.querySelector<HTMLElement>('div');
		if (!row) throw new Error('Property row fixture did not parse.');
		const groups = propertyGroupEntries([{ row, key: 'status' }], {
			propertyGroups: [{ id: 'work', name: '工作', order: 0 }],
			propertyStyles: {}, tagsEnabled: true, propertiesEnabled: true,
		});
		expect(groups.map((group) => [group.name, group.members.length])).toEqual([
			['工作', 0], ['未分组', 1],
		]);
	});

	it('nests every native property row under its configured group section', () => {
		const parsed = new DOMParser().parseFromString(`
			<div data-type="all-properties"><div class="tree-item-children">
				<div class="tree-item"><div class="tree-item-self"><span class="tree-item-inner-text">status</span></div></div>
				<div class="tree-item"><div class="tree-item-self"><span class="tree-item-inner-text">owner</span></div></div>
				<div class="tree-item"><div class="tree-item-self"><span class="tree-item-inner-text">priority</span></div></div>
			</div></div>
		`, 'text/html');
		const container = parsed.querySelector<HTMLElement>('.tree-item-children');
		if (!container) throw new Error('Property sidebar fixture did not parse.');
		const rows = collectNativePropertyRows(parsed).map((row) => ({ row, key: nativePropertyKey(row) }));
		renderNativePropertyGroups(container, propertyGroupEntries(rows, {
			propertyGroups: [
				{ id: 'workflow', name: '流程', order: 0 },
				{ id: 'people', name: '人员', order: 1 },
			],
			propertyStyles: {
				status: { groupId: 'workflow' }, owner: { groupId: 'people' }, priority: { groupId: 'missing' },
			},
			tagsEnabled: true, propertiesEnabled: true,
		}));
		const sections = Array.from(container.querySelectorAll<HTMLElement>('.op-property-group-section'));
		expect(sections.map((section) => section.querySelector('.op-property-group-heading')?.textContent)).toEqual(['流程', '人员', '未分组']);
		expect(sections.map((section) => Array.from(section.querySelectorAll('.tree-item-inner-text')).map((item) => item.textContent))).toEqual([
			['status'], ['owner'], ['priority'],
		]);
	});
});
