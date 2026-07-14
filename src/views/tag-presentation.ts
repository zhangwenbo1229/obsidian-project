import { setIcon } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { TagStyle } from '../domain/types';

function tagStyle(manager: ProjectManager, tag: string): TagStyle | undefined {
	let path = tag;
	while (path) {
		const style = manager.tagStyles[path];
		if (style) return style;
		const separator = path.lastIndexOf('/');
		if (separator < 0) break;
		path = path.slice(0, separator);
	}
	return undefined;
}

export function renderTag(parent: HTMLElement, tag: string, manager: ProjectManager): HTMLElement {
	const style = tagStyle(manager, tag);
	const element = parent.createSpan({ cls: 'op-rendered-tag' });
	if (style?.color) element.style.setProperty('--op-tag-color', style.color);
	if (style?.icon) {
		const icon = element.createSpan({ cls: 'op-rendered-tag-icon', attr: { 'aria-hidden': 'true' } });
		if (/^[a-z0-9][a-z0-9-]*$/iu.test(style.icon)) {
			setIcon(icon, style.icon);
			if (!icon.querySelector('svg')) icon.setText(style.icon);
		} else icon.setText(style.icon);
	}
	element.createSpan({ cls: 'op-rendered-tag-label', text: tag });
	return element;
}

export function renderTags(parent: HTMLElement, tags: readonly string[], manager: ProjectManager): HTMLElement | null {
	if (tags.length === 0) return null;
	const group = parent.createSpan({ cls: 'op-rendered-tags' });
	for (const tag of tags) renderTag(group, tag, manager);
	return group;
}
