// @vitest-environment happy-dom

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applyValuePresentation, renderFieldLabel } from '../../src/views/field-presentation';
import { renderGroupedTagPicker } from '../../src/modals/grouped-tag-picker';
import { applyInternalTagVisibility } from '../../src/integrations/native-sidebar-dom';

type CreateOptions = { cls?: string; text?: string; type?: string; attr?: Record<string, string> };

function appendElement(parent: HTMLElement, tag: string, options: CreateOptions = {}): HTMLElement {
	const element = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
	if (options.cls) element.className = options.cls;
	if (options.text !== undefined) element.textContent = options.text;
	if (options.type && element.tagName === 'INPUT') (element as HTMLInputElement).type = options.type;
	for (const [name, value] of Object.entries(options.attr ?? {})) element.setAttribute(name, value);
	parent.appendChild(element);
	return element;
}

beforeAll(() => {
	Object.defineProperties(HTMLElement.prototype, {
		createEl: { configurable: true, value(this: HTMLElement, tag: string, options: CreateOptions = {}) {
			return appendElement(this, tag, options);
		} },
		createDiv: { configurable: true, value(this: HTMLElement, options: CreateOptions = {}) { return appendElement(this, 'div', options); } },
		createSpan: { configurable: true, value(this: HTMLElement, options: CreateOptions = {}) { return appendElement(this, 'span', options); } },
		empty: { configurable: true, value(this: HTMLElement) { this.replaceChildren(); } },
		setText: { configurable: true, value(this: HTMLElement, value: string) { this.textContent = value; } },
		addClass: { configurable: true, value(this: HTMLElement, ...names: string[]) { this.classList.add(...names); } },
	});
});

describe('field and tag DOM behavior', () => {
	it('applies configured color and icon to actual field elements', () => {
		const field = document.body.createDiv();
		applyValuePresentation(field, { color: '#008800' });
		const label = renderFieldLabel(field, '计划日期', { icon: 'calendar-clock', color: '#008800' });
		expect(field.style.getPropertyValue('--op-field-color')).toBe('#008800');
		expect(label.style.color).toBe('#008800');
		expect(label.querySelector('.op-field-label-icon')?.textContent).toBe('calendar-clock');
	});

	it('switches tag groups and selects a filtered suggestion', () => {
		const onChange = vi.fn();
		const manager = {
			index: { validTasks: () => [{ document: { metadata: { tags: ['feature/mobile', 'feature/web', 'misc'] } } }] },
			tagGroups: [{ id: 'product', name: '产品', order: 0 }],
			tagGroupAssignments: { feature: 'product' },
			orderTags: (tags: string[]) => [...tags].sort(),
			assignTagGroup: vi.fn(() => Promise.resolve()),
		};
		const host = document.body.createDiv();
		renderGroupedTagPicker(host, manager as never, [], onChange);
		const groupSelect = host.querySelector<HTMLSelectElement>('.op-grouped-tag-picker-group-select')!;
		expect(groupSelect.value).toBe('');
		expect(Array.from(groupSelect.options).map((option) => option.text)).toEqual(['未分组', '产品']);
		expect(host.querySelectorAll('input[type="radio"]')).toHaveLength(0);
		groupSelect.value = 'product';
		groupSelect.dispatchEvent(new Event('change'));
		const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
		search.value = 'web';
		search.dispatchEvent(new Event('input'));
		const suggestion = Array.from(host.querySelectorAll<HTMLButtonElement>('.op-grouped-tag-picker-suggestion'))
			.find((button) => button.textContent === 'feature/web')!;
		suggestion.click();
		expect(onChange).toHaveBeenLastCalledWith(['feature/web']);
	});

	it('hides the internal task metadata namespace from the native tag sidebar', () => {
		const wrapper = document.body.createDiv({ cls: 'tree-item' });
		const row = wrapper.createDiv({ cls: 'tag-pane-tag' });
		expect(applyInternalTagVisibility(row, 'op-meta')).toBe(true);
		expect(wrapper.classList.contains('op-internal-task-metadata-tag')).toBe(true);
		expect(applyInternalTagVisibility(row, 'feature/mobile')).toBe(false);
		expect(wrapper.classList.contains('op-internal-task-metadata-tag')).toBe(false);
	});
});
