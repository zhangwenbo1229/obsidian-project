import { describe, expect, it } from 'vitest';
import {
	buildDirectoryTree,
	collectNoteStatistics,
	countFilteredFiles,
	filterFilesByRoot,
	filterFilesByScope,
	formatRelativeTime,
	selectRecentFiles,
	selectDashboardFiles,
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

	it('excludes configured directories without excluding similarly prefixed siblings', () => {
		const scoped = filterFilesByScope([
			...files,
			{ path: 'Work/Archive/Old.md', basename: 'Old', stat: { mtime: 800, ctime: 1, size: 2 } },
			{ path: 'Work/Archive-old/Keep.md', basename: 'Keep', stat: { mtime: 700, ctime: 1, size: 2 } },
		], 'Work', ['Work/Archive']);
		expect(scoped.map((file) => file.path)).toEqual([
			'Work/Alpha.md', 'Work/Plans/Beta.md', 'Work/Archive-old/Keep.md',
		]);
	});

	it('applies directory exclusions to recent files and note statistics', async () => {
		const recent = selectRecentFiles(files, '', 10, ['Personal']);
		expect(recent.map((file) => file.path)).toEqual(['Work/Plans/Beta.md', 'Work/Alpha.md']);
		const stats = await collectNoteStatistics(files, () => Promise.resolve('x'), '', 5, ['Work/Plans']);
		expect(stats.noteCount).toBe(2);
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

	it('filters note statistics by extension and frontmatter metadata', async () => {
		const mixed = [
			...files,
			{ path: 'Work/Data.json', basename: 'Data', stat: { mtime: 600, ctime: 3, size: 30 } },
		];
		const stats = await collectNoteStatistics(
			mixed,
			() => Promise.resolve('body'),
			'',
			5,
			[],
			{
				extensions: ['md'], metadataKey: 'status', metadataValue: 'active',
				frontmatter: (file) => file.path === 'Work/Alpha.md' ? { status: 'active' } : { status: 'archived' },
			},
		);
		expect(stats.noteCount).toBe(1);
		expect(stats.totalSize).toBe(12);
	});

	it('counts independent file metrics without reading file contents', () => {
		expect(countFilteredFiles(files, 'Work', ['Work/Plans'], {
			extensions: ['md'], metadataKey: 'status', metadataValue: 'active',
			frontmatter: (file) => file.path === 'Work/Alpha.md' ? { status: 'active' } : undefined,
		})).toBe(1);
	});

	it('sorts file card modes by creation, editing, and open frequency', () => {
		const ranked = [
			{ path: 'a.md', basename: 'a', stat: { mtime: 10, ctime: 30, size: 1 } },
			{ path: 'b.md', basename: 'b', stat: { mtime: 40, ctime: 20, size: 1 } },
			{ path: 'c.md', basename: 'c', stat: { mtime: 20, ctime: 10, size: 1 } },
		];
		expect(selectDashboardFiles(ranked, '', 3, [], 'recent-created', {}).map((file) => file.path)).toEqual(['a.md', 'b.md', 'c.md']);
		expect(selectDashboardFiles(ranked, '', 3, [], 'recent-files', {}).map((file) => file.path)).toEqual(['b.md', 'c.md', 'a.md']);
		expect(selectDashboardFiles(ranked, '', 3, [], 'recent-edited', {}).map((file) => file.path)).toEqual(['b.md', 'c.md', 'a.md']);
		expect(selectDashboardFiles(ranked, '', 3, [], 'frequently-opened', { 'c.md': 9, 'a.md': 2 }).map((file) => file.path)).toEqual(['c.md', 'a.md', 'b.md']);
	});
});
