import { describe, expect, it } from 'vitest';
import { buildVaultHeatmap } from '../../src/views/dashboard-modules/heatmap-model';

describe('dashboard heatmap model', () => {
	it('aggregates current file mtimes by local date and applies scope', () => {
		const files = [
			{ path: 'Notes/a.md', stat: { mtime: new Date(2026, 6, 14, 8).getTime() } },
			{ path: 'Notes/b.md', stat: { mtime: new Date(2026, 6, 14, 18).getTime() } },
			{ path: 'Notes/Archive/c.md', stat: { mtime: new Date(2026, 6, 13).getTime() } },
			{ path: 'Other/d.md', stat: { mtime: new Date(2026, 6, 14).getTime() } },
		];
		const model = buildVaultHeatmap(files, ['Notes'], ['Notes/Archive'], 30, new Date(2026, 6, 14));
		expect(model.cells.length % 7).toBe(0);
		expect(model.cells.find((cell) => cell.date === '2026-07-14')).toMatchObject({ count: 2, level: 4 });
		expect(model.total).toBe(2);
	});
});
