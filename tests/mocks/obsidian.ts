export function normalizePath(path: string): string {
	return path;
}

export class TFile {}

export class TFolder {}

export const activeWindow = {
	setTimeout,
	clearTimeout,
} as unknown as Window;

export function setIcon(element: HTMLElement, icon: string): void {
	const marker = element.ownerDocument.createElement('span');
	marker.dataset.icon = icon;
	element.appendChild(marker);
}
