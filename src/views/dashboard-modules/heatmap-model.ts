export interface HeatmapCell {
	date: string;
	count: number;
	level: number;
}

function normalizePath(path: string): string { return path.trim().replace(/^\/+|\/+$/gu, ''); }
function belongsTo(path: string, root: string): boolean {
	const value = normalizePath(root);
	return !value || path === value || path.startsWith(`${value}/`);
}
function iso(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildVaultHeatmap(
	files: readonly { path: string; stat: { mtime: number } }[],
	rootPaths: readonly string[],
	excludePaths: readonly string[],
	days: number,
	now = new Date(),
) {
	const roots = rootPaths.map(normalizePath).filter(Boolean);
	const exclusions = excludePaths.map(normalizePath).filter(Boolean);
	const counts = new Map<string, number>();
	for (const file of files) {
		if (roots.length > 0 && !roots.some((root) => belongsTo(file.path, root))) continue;
		if (exclusions.some((root) => belongsTo(file.path, root))) continue;
		const key = iso(new Date(file.stat.mtime));
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const start = new Date(end);
	start.setDate(start.getDate() - Math.max(1, days) + 1);
	start.setDate(start.getDate() - start.getDay());
	const last = new Date(end);
	last.setDate(last.getDate() + (6 - last.getDay()));
	const maximum = Math.max(0, ...counts.values());
	const cells: HeatmapCell[] = [];
	for (const cursor = new Date(start); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
		const date = iso(cursor);
		const count = counts.get(date) ?? 0;
		cells.push({ date, count, level: count === 0 || maximum === 0 ? 0 : Math.max(1, Math.ceil(count / maximum * 4)) });
	}
	return { cells, total: cells.reduce((sum, cell) => sum + cell.count, 0), maximum };
}
