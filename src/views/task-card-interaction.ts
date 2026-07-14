const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, summary, [contenteditable="true"]';

export function isInteractiveTaskCardTarget(target: EventTarget | null): boolean {
	const candidate = target as { closest?(selector: string): Element | null; parentElement?: Element | null } | null;
	const element = typeof candidate?.closest === 'function' ? candidate : candidate?.parentElement;
	return Boolean(element?.closest?.(INTERACTIVE_SELECTOR));
}

export function bindTaskCardActivation(element: HTMLElement, activate: () => void): void {
	element.addEventListener('click', (event) => {
		if (!isInteractiveTaskCardTarget(event.target)) activate();
	});
	element.addEventListener('keydown', (event) => {
		if (isInteractiveTaskCardTarget(event.target) || (event.key !== 'Enter' && event.key !== ' ')) return;
		event.preventDefault();
		activate();
	});
}
