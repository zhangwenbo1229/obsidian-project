import { setIcon, type Setting } from 'obsidian';

export interface FieldPresentation {
	icon?: string;
	color?: string;
}

function createFieldIcon(parent: HTMLElement, iconName: string): HTMLElement {
	const icon = parent.createSpan({ cls: 'op-field-label-icon', attr: { 'aria-hidden': 'true' } });
	if (/^[a-z0-9][a-z0-9-]*$/iu.test(iconName)) {
		setIcon(icon, iconName);
		if (!icon.querySelector('svg')) icon.setText(iconName);
	} else icon.setText(iconName);
	return icon;
}

export function applyLabelPresentation(label: HTMLElement, presentation: FieldPresentation | undefined): void {
	if (!presentation) return;
	if (presentation.color) label.style.color = presentation.color;
	if (presentation.icon) label.prepend(createFieldIcon(label, presentation.icon));
}

export function applyValuePresentation(element: HTMLElement, presentation: FieldPresentation | undefined): void {
	if (!presentation?.color) return;
	element.style.setProperty('--op-field-color', presentation.color);
	element.style.color = presentation.color;
}

export function applyFieldPresentation(setting: Setting, presentation: FieldPresentation | undefined): void {
	if (!presentation) return;
	applyLabelPresentation(setting.nameEl, presentation);
}

export function renderFieldLabel(parent: HTMLElement, text: string, presentation: FieldPresentation | undefined): HTMLElement {
	const label = parent.createSpan({ cls: 'op-card-field-label' });
	label.createSpan({ text });
	applyLabelPresentation(label, presentation);
	return label;
}
