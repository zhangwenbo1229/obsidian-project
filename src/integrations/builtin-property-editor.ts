import { Menu, Plugin, setIcon } from 'obsidian';
import type { NativeSidebarSettings } from '../settings/native-sidebar-settings';

const PROPERTY_ROW_SELECTOR = '.metadata-property, [data-property-key], [data-type="all-properties"] .tree-item-self';

export function nativePropertyKey(row: HTMLElement): string {
	return (row.dataset.propertyKey
		?? row.querySelector<HTMLInputElement>('.metadata-property-key-input')?.value
		?? row.querySelector<HTMLElement>('.metadata-property-key')?.textContent
		?? row.querySelector<HTMLElement>('.tree-item-inner-text')?.textContent
		?? '').trim();
}

export function collectNativePropertyRows(root: ParentNode): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(PROPERTY_ROW_SELECTOR));
}

export function nativePropertyGroupAnchor(row: HTMLElement): HTMLElement {
	return row.closest<HTMLElement>('[data-type="all-properties"] .tree-item') ?? row;
}

export function isNativePropertySidebarRow(row: HTMLElement): boolean {
	return row.closest('[data-type="all-properties"]') !== null;
}

interface PropertyRowEntry { row: HTMLElement; key: string }

type PropertyGroupEntry = ReturnType<typeof propertyGroupEntries>[number];

function addGroupIcon(heading: HTMLElement, icon: string): void {
	const marker = heading.ownerDocument.createElement('span');
	marker.className = 'op-property-group-icon';
	heading.append(marker);
	if (/^[a-z0-9][a-z0-9-]*$/iu.test(icon)) setIcon(marker, icon);
	else marker.textContent = icon;
}

export function propertyGroupEntries(rows: readonly PropertyRowEntry[], settings: NativeSidebarSettings) {
	const groups = [
		...settings.propertyGroups.slice().sort((left, right) => left.order - right.order),
		{ id: '', name: '未分组', order: Number.MAX_SAFE_INTEGER, icon: 'inbox' },
	];
	const validGroupIds = new Set(settings.propertyGroups.map((group) => group.id));
	return groups.map((group) => ({
		...group,
		members: rows.filter(({ key }) => {
			const assignedGroupId = settings.propertyStyles[key]?.groupId;
			return group.id ? assignedGroupId === group.id : !assignedGroupId || !validGroupIds.has(assignedGroupId);
		}),
	})).filter((group) => group.id || group.members.length > 0);
}

export function unwrapNativePropertyGroups(root: ParentNode): void {
	for (const section of Array.from(root.querySelectorAll<HTMLElement>('.op-property-group-section'))) {
		const parent = section.parentElement;
		if (!parent) continue;
		for (const anchor of Array.from(section.querySelectorAll<HTMLElement>(':scope > .op-property-group-members > .tree-item'))) {
			parent.insertBefore(anchor, section);
		}
		section.remove();
	}
}

export function renderNativePropertyGroups(container: HTMLElement, groups: readonly PropertyGroupEntry[]): void {
	const ownerDocument = container.ownerDocument;
	for (const group of groups) {
		const section = ownerDocument.createElement('section');
		section.className = 'op-property-group-section';
		section.dataset.groupId = group.id;
		const heading = ownerDocument.createElement('div');
		heading.className = 'op-property-group-heading';
		section.append(heading);
		heading.dataset.groupId = group.id;
		heading.style.setProperty('--op-property-group-color', group.color ?? '');
		if (group.icon) addGroupIcon(heading, group.icon);
		const name = ownerDocument.createElement('span');
		name.textContent = group.name;
		heading.append(name);
		const members = ownerDocument.createElement('div');
		members.className = 'op-property-group-members';
		section.append(members);
		for (const member of group.members) members.append(nativePropertyGroupAnchor(member.row));
		container.append(section);
	}
}

function addNativePropertyMenuItem(
	menu: HTMLElement,
	group: HTMLElement,
	title: string,
	iconName: string,
	action: () => void,
): void {
	if (Array.from(group.querySelectorAll<HTMLElement>('.menu-item-title')).some((item) => item.textContent === title)) return;
	const item = group.ownerDocument.createElement('div');
	item.className = 'menu-item tappable op-property-menu-item';
	item.dataset.section = 'action';
	item.setAttribute('role', 'menuitem');
	item.tabIndex = -1;
	const icon = group.ownerDocument.createElement('div');
	icon.className = 'menu-item-icon';
	setIcon(icon, iconName);
	item.append(icon);
	const label = group.ownerDocument.createElement('div');
	label.className = 'menu-item-title';
	label.textContent = title;
	item.append(label);
	const activate = (event: Event) => {
		event.preventDefault();
		event.stopPropagation();
		menu.remove();
		action();
	};
	item.addEventListener('click', activate);
	item.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') activate(event);
	});
	group.append(item);
}

export function appendNativePropertyMenuActions(
	root: ParentNode,
	onEditProperty: () => void,
	onCreateGroup: () => void,
): boolean {
	const nativeMenu = Array.from(root.querySelectorAll<HTMLElement>('.menu')).reverse()
		.find((menu) => menu.textContent?.includes('删除属性'));
	if (!nativeMenu) return false;
	const actionGroup = Array.from(nativeMenu.querySelectorAll<HTMLElement>('.menu-group'))
		.find((group) => !group.textContent?.includes('删除属性'));
	if (!actionGroup) return false;
	addNativePropertyMenuItem(nativeMenu, actionGroup, '编辑属性样式与分组', 'palette', onEditProperty);
	addNativePropertyMenuItem(nativeMenu, actionGroup, '新建属性分组', 'folder-plus', onCreateGroup);
	return true;
}

export function registerBuiltinPropertyEditor(
	plugin: Plugin,
	settings: () => NativeSidebarSettings,
	onEditProperty: (key: string) => void,
	onEditGroup: (groupId?: string) => void,
	onDeleteGroup: (groupId: string) => void,
): void {
	const ownerDocument = plugin.app.workspace.containerEl.ownerDocument;
	const Observer = ownerDocument.defaultView?.MutationObserver;
	const observerOptions: MutationObserverInit = { childList: true, subtree: true };
	let observer: MutationObserver | null = null;
	const renderContent = () => {
		unwrapNativePropertyGroups(ownerDocument);
		ownerDocument.querySelectorAll('.op-property-group-heading').forEach((element) => element.remove());
		for (const row of collectNativePropertyRows(ownerDocument)) {
			row.removeClass('op-property-managed');
			row.style.removeProperty('--op-property-color');
			row.querySelector(':scope > .op-property-style-icon')?.remove();
		}
		const current = settings();
		if (!current.propertiesEnabled) return;
		const rows = collectNativePropertyRows(ownerDocument)
			.map((row) => ({ row, key: nativePropertyKey(row) })).filter((entry) => entry.key);
		for (const { row, key } of rows) {
			const style = current.propertyStyles[key];
			row.addClass('op-property-managed');
			row.style.setProperty('--op-property-color', style?.color ?? '');
			if (style?.icon) {
				const icon = ownerDocument.createElement('span');
				icon.className = 'op-property-style-icon';
				if (/^[a-z0-9][a-z0-9-]*$/iu.test(style.icon)) setIcon(icon, style.icon);
				else icon.setText(style.icon);
				row.insertBefore(icon, row.firstChild);
			}
		}
		const sidebarRows = rows.filter((entry) => isNativePropertySidebarRow(entry.row));
		const sidebarContainer = sidebarRows[0]
			? nativePropertyGroupAnchor(sidebarRows[0].row).parentElement
			: ownerDocument.querySelector<HTMLElement>('[data-type="all-properties"] .tree-item-children, [data-type="all-properties"] .nav-files-container');
		if (sidebarContainer) renderNativePropertyGroups(sidebarContainer, propertyGroupEntries(sidebarRows, current));
	};
	let queued = false;
	let refreshTimer: number | undefined;
	let menuActionTimer: number | undefined;
	const observe = () => observer?.observe(ownerDocument.body, observerOptions);
	const render = () => {
		observer?.disconnect();
		try {
			renderContent();
		} finally {
			observe();
		}
	};
	const schedule = () => {
		if (queued) return;
		queued = true;
		refreshTimer = ownerDocument.defaultView?.setTimeout(() => { queued = false; render(); }, 0);
	};
	observer = Observer ? new Observer(schedule) : null;
	observe();
	plugin.register(() => {
		observer?.disconnect();
		if (refreshTimer !== undefined) ownerDocument.defaultView?.clearTimeout(refreshTimer);
		if (menuActionTimer !== undefined) ownerDocument.defaultView?.clearTimeout(menuActionTimer);
	});
	plugin.registerDomEvent(ownerDocument, 'contextmenu', (event) => {
		const target = event.target instanceof HTMLElement ? event.target : null;
		const heading = target?.closest<HTMLElement>('.op-property-group-heading');
		const row = target?.closest<HTMLElement>(PROPERTY_ROW_SELECTOR);
		if (!settings().propertiesEnabled || (!heading && !row)) return;
		if (heading) {
			event.preventDefault();
			event.stopPropagation();
			const groupId = heading.dataset.groupId ?? '';
			const menu = new Menu();
			menu.addItem((item) => item.setTitle('新建属性分组').setIcon('folder-plus').onClick(() => onEditGroup()));
			menu.addItem((item) => item.setTitle('编辑属性分组').setIcon('folder-cog').setDisabled(!groupId).onClick(() => { if (groupId) onEditGroup(groupId); }));
			menu.addItem((item) => item.setTitle('删除属性分组').setIcon('trash-2').setDisabled(!groupId).onClick(() => { if (groupId) onDeleteGroup(groupId); }));
			menu.showAtMouseEvent(event);
			return;
		}
		if (!row) return;
		const appendActions = () => appendNativePropertyMenuActions(
			ownerDocument,
			() => onEditProperty(nativePropertyKey(row)),
			() => onEditGroup(),
		);
		if (!appendActions()) {
			if (menuActionTimer !== undefined) ownerDocument.defaultView?.clearTimeout(menuActionTimer);
			menuActionTimer = ownerDocument.defaultView?.setTimeout(() => {
				menuActionTimer = undefined;
				appendActions();
			}, 0);
		}
	});
	render();
}
