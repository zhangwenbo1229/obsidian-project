export function resizeColumnWidth(width: number, delta: number): number {
	return Math.min(640, Math.max(72, Math.round(width + delta)));
}

export function totalColumnWidth(widths: readonly number[]): number {
	return widths.reduce((total, width) => total + Math.max(0, width), 0);
}
