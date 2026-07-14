import { setIcon } from 'obsidian';
import type { TaskTypeDefinition } from '../domain/types';

interface TaskTitleOptions {
	tagName?: 'div' | 'span' | 'strong';
	className?: string;
	taskKey?: string;
	showMarker?: boolean;
}

export function renderTaskMarker(
	parent: HTMLElement,
	taskType: TaskTypeDefinition | undefined,
	className = '',
): HTMLElement | null {
	const marker = taskType ? taskType.marker ?? taskType.icon : '';
	if (!marker) return null;
	const markerEl = parent.createSpan({ cls: `op-task-type-marker ${className}`.trim(), attr: { 'aria-hidden': 'true' } });
	if (/^[a-z0-9][a-z0-9-]*$/iu.test(marker)) {
		setIcon(markerEl, marker);
		if (!markerEl.querySelector('svg')) markerEl.setText(marker);
	} else {
		markerEl.setText(marker);
	}
	return markerEl;
}

export function renderTaskTitle(
	parent: HTMLElement,
	taskType: TaskTypeDefinition | undefined,
	titleText: string,
	options: TaskTitleOptions = {},
): HTMLElement {
	const title = parent.createEl(options.tagName ?? 'div', { cls: `op-task-title ${options.className ?? ''}`.trim() });
	if (options.showMarker !== false) renderTaskMarker(title, taskType);
	if (options.taskKey) title.createSpan({ cls: 'op-task-title-key', text: `${options.taskKey} ·` });
	if (taskType?.titleColor) title.style.setProperty('--op-task-title-color', taskType.titleColor);
	title.createSpan({ cls: 'op-task-title-text', text: titleText });
	return title;
}
