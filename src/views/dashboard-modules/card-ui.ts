import { setIcon } from 'obsidian';

export function createModuleBody(container: HTMLElement, className: string): HTMLElement {
	return container.createDiv({ cls: `op-dashboard-module-body ${className}` });
}

export function createHeadingButton(
	heading: HTMLElement,
	icon: string,
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	let actions = heading.querySelector<HTMLElement>('.op-dashboard-module-actions');
	if (!actions) actions = heading.createDiv({ cls: 'op-dashboard-module-actions' });
	const button = actions.createEl('button', {
		cls: 'op-dashboard-module-action',
		attr: { type: 'button', 'aria-label': label, title: label },
	});
	setIcon(button, icon);
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		onClick();
	});
	return button;
}

export function renderModuleMessage(
	container: HTMLElement,
	icon: string,
	title: string,
	description: string,
	className = 'op-dashboard-module-empty',
): HTMLElement {
	const state = container.createDiv({ cls: `op-dashboard-module-state ${className}` });
	const iconEl = state.createSpan({ cls: 'op-dashboard-module-state-icon' });
	setIcon(iconEl, icon);
	state.createEl('strong', { text: title });
	state.createEl('p', { text: description });
	return state;
}

export function formatCompactNumber(value: number): string {
	return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
