import { isInternalTaskMetadataTag } from '../markdown/task-custom-metadata-codec';

const TAG_ROW_SELECTORS = ['.tag-pane-tag', '[data-tag]'] as const;
const TAG_TEXT_SELECTORS = [
	'.tag-pane-tag-text',
	'.tree-item-inner-text .tree-item-inner-text',
	'.tree-item-inner > .tree-item-inner-text',
	'.tree-item-inner-text',
] as const;
const PROPERTY_ROW_SELECTORS = [
	'.metadata-property',
	'[data-property-key]',
	'[data-type="all-properties"] .tree-item-self',
] as const;

function queryAllUnique(root: ParentNode, selectors: readonly string[]): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(',')));
}

export function findNativeTagRows(root: ParentNode): HTMLElement[] {
	return queryAllUnique(root, TAG_ROW_SELECTORS);
}

export function nativeTagTextFromRow(row: HTMLElement): HTMLElement | null {
	for (const selector of TAG_TEXT_SELECTORS) {
		const text = row.querySelector<HTMLElement>(selector);
		if (text) return text;
	}
	return null;
}

export function closestNativeTagRow(target: HTMLElement): HTMLElement | null {
	return target.closest<HTMLElement>(TAG_ROW_SELECTORS.join(','));
}

export function findNativePropertyRows(root: ParentNode): HTMLElement[] {
	return queryAllUnique(root, PROPERTY_ROW_SELECTORS);
}

export function nativePropertyKeyFromRow(row: HTMLElement): string {
	return (row.dataset.propertyKey
		?? row.querySelector<HTMLInputElement>('.metadata-property-key-input')?.value
		?? row.querySelector<HTMLElement>('.metadata-property-key')?.textContent
		?? row.querySelector<HTMLElement>('.tree-item-inner-text')?.textContent
		?? '').trim();
}

export function closestNativePropertyRow(target: HTMLElement): HTMLElement | null {
	return target.closest<HTMLElement>(PROPERTY_ROW_SELECTORS.join(','));
}

export function findNativePropertyMenu(root: ParentNode): { menu: HTMLElement; actionGroup: HTMLElement } | null {
	const groupHasTitle = (group: HTMLElement, expected: string) => {
		const titles = Array.from(group.querySelectorAll<HTMLElement>('.menu-item-title'));
		if (titles.length > 0) return titles.some((title) => title.textContent?.trim() === expected);
		return Array.from(group.querySelectorAll<HTMLElement>('.menu-item'))
			.some((item) => item.textContent?.trim() === expected);
	};
	const menu = Array.from(root.querySelectorAll<HTMLElement>('.menu')).reverse()
		.find((candidate) => groupHasTitle(candidate, '删除属性'));
	if (!menu) return null;
	const actionGroup = Array.from(menu.querySelectorAll<HTMLElement>('.menu-group'))
		.find((group) => !groupHasTitle(group, '删除属性'));
	return actionGroup ? { menu, actionGroup } : null;
}

export function applyInternalTagVisibility(row: HTMLElement, path: string): boolean {
	const wrapper = row.closest<HTMLElement>('.tree-item') ?? row;
	const internal = isInternalTaskMetadataTag(path);
	wrapper.toggleAttribute('hidden', internal);
	wrapper.classList.toggle('op-internal-task-metadata-tag', internal);
	return internal;
}
