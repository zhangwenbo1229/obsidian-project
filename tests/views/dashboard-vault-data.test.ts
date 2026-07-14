import { describe, expect, it } from 'vitest';
import {
	buildDirectoryTree,
	collectNoteStatistics,
	filterFilesByRoot,
	formatRelativeTime,
	selectRecentFiles,
} from '../../src/views/dashboard-modules/vault-data';

const files = [
	{ path: 'Work/Alpha.md', basename: 'Alpha', stat: { mtime: 300, ctime: 1, size: 12 } },
	{ path: 'Work/Plans/Beta.md', basename: 'Beta', stat: { mtime: 500, ctime: 1, size: 18 } },
	{ path: 'Personal/Gamma.md', basename: 'Gamma', stat: { mtime: 400, ctime: 1, size: 6 } },
];

describe('dashboard vault data', () => {
	it('filters by an exact root boundary and sorts recent notes by mtime', () => {
		expect(filterFilesByRoot(files, 'Work').map((file) => file.path)).toEqual([
			'Work/Alpha.md', 'Work/Plans/Beta.md',
		]);
		expect(selectRecentFiles(files, '', 2).map((file) => file.path)).toEqual([
			'Work/Plans/Beta.md', 'Personal/Gamma.md',
		]);
	});

	it('collects note, character, folder and top-folder statistics', async () => {
		const contents = new Map([
			['Work/Alpha.md', '# Alpha\n正文'],
			['Work/Plans/Beta.md', 'Beta'],
			['Personal/Gamma.md', 'Gamma'],
		]);
		const stats = await collectNoteStatistics(files, (file) => Promise.resolve(contents.get(file.path) ?? ''), '', 2);
		expect(stats.noteCount).toBe(3);
		expect(stats.characterCount).toBe(19);
		expect(stats.folderCount).toBe(3);
		expect(stats.topFolders).toEqual([
			{ path: 'Work', count: 2 },
			{ path: 'Personal', count: 1 },
		]);
	});

	it('builds a bounded directory tree from selected roots', () => {
		const tree = buildDirectoryTree(files, ['Work'], 2);
		expect(tree).toHaveLength(1);
		expect(tree[0]).toMatchObject({ name: 'Work', path: 'Work', kind: 'folder' });
		expect(tree[0]?.children.map((item) => item.name)).toEqual(['Plans', 'Alpha']);
		expect(tree[0]?.children[0]?.children).toEqual([]);
	});

	it('keeps root-level notes when no directory roots are configured', () => {
		const tree = buildDirectoryTree([
			...files,
			{ path: 'Inbox.md', basename: 'Inbox', stat: { mtime: 600, ctime: 1, size: 4 } },
		], [], 3);
		expect(tree.map((node) => [node.name, node.kind])).toEqual([
			['Personal', 'folder'],
			['Work', 'folder'],
			['Inbox', 'file'],
		]);
	});

	it('formats recent timestamps without exposing raw timezone details', () => {
		const now = Date.UTC(2026, 6, 14, 4, 0, 0);
		expect(formatRelativeTime(now - 30_000, now)).toBe('刚刚');
		expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 分钟前');
		expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe('3 天前');
	});
});
