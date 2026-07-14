import { setIcon } from 'obsidian';

function wrapTaskContent(control: HTMLElement): void {
	const host = control.parentElement;
	if (!host || host.querySelector(':scope > .op-task-list-content')) return;
	const content = host.ownerDocument.createElement('span');
	content.className = 'op-task-list-content';
	let sibling = control.nextSibling;
	while (sibling) {
		if (sibling.nodeName === 'UL' || sibling.nodeName === 'OL') break;
		const next = sibling.nextSibling;
		content.appendChild(sibling);
		sibling = next;
	}
	if (content.childNodes.length > 0) host.insertBefore(content, sibling);
}

export function enhanceRenderedTaskLists(container: HTMLElement): void {
	for (const checkbox of Array.from(container.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox'))) {
		const item = checkbox.closest<HTMLElement>('.task-list-item');
		if (!item) continue;
		let control = checkbox.closest<HTMLElement>('.op-task-checkbox-control');
		let marker = control?.querySelector<HTMLElement>('.op-task-checkbox-marker') ?? null;
		if (!control) {
			control = checkbox.ownerDocument.createElement('span');
			control.className = 'op-task-checkbox-control';
			checkbox.replaceWith(control);
			control.appendChild(checkbox);
			marker = checkbox.ownerDocument.createElement('span');
			marker.className = 'op-task-checkbox-marker';
			marker.setAttribute('aria-hidden', 'true');
			setIcon(marker, 'check');
			control.appendChild(marker);
			wrapTaskContent(control);
		}
		const sync = () => item.toggleClass('is-checked', checkbox.checked);
		checkbox.addEventListener('change', sync);
		sync();
	}
}
