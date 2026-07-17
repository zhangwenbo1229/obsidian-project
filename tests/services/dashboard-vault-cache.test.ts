import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dashboard Vault cache', () => {
	it('deduplicates file lists and concurrent Markdown reads until invalidated', async () => {
		const moduleUrl = new URL('../../src/services/dashboard-vault-cache.ts', import.meta.url);
		expect(existsSync(moduleUrl)).toBe(true);
		if (!existsSync(moduleUrl)) return;
		const { DashboardVaultCache } = await import('../../src/services/dashboard-vault-cache');
		const file = { path: 'Work/Alpha.md', extension: 'md', stat: { mtime: 1, ctime: 1, size: 10 } };
		let listCalls = 0;
		let markdownListCalls = 0;
		let readCalls = 0;
		const vault = {
			getFiles: () => { listCalls += 1; return [file]; },
			getMarkdownFiles: () => { markdownListCalls += 1; return [file]; },
			cachedRead: async () => { readCalls += 1; return '# Alpha'; },
		};
		const cache = new DashboardVaultCache(vault as never);
		expect(cache.allFiles()).toBe(cache.allFiles());
		expect(cache.markdownFiles()).toBe(cache.markdownFiles());
		expect(listCalls).toBe(1);
		expect(markdownListCalls).toBe(1);
		const [first, second] = await Promise.all([cache.read(file as never), cache.read(file as never)]);
		expect(first).toBe('# Alpha');
		expect(second).toBe('# Alpha');
		expect(readCalls).toBe(1);
		cache.invalidate('Work/Alpha.md');
		cache.allFiles();
		cache.markdownFiles();
		await cache.read(file as never);
		expect(listCalls).toBe(2);
		expect(markdownListCalls).toBe(2);
		expect(readCalls).toBe(2);
	});

	it('invalidates both sides of a rename and can clear the entire cache', async () => {
		const moduleUrl = new URL('../../src/services/dashboard-vault-cache.ts', import.meta.url);
		if (!existsSync(moduleUrl)) return;
		const { DashboardVaultCache } = await import('../../src/services/dashboard-vault-cache');
		const files = new Map([
			['old.md', { path: 'old.md', extension: 'md', stat: { mtime: 1, ctime: 1, size: 1 } }],
			['new.md', { path: 'new.md', extension: 'md', stat: { mtime: 2, ctime: 1, size: 1 } }],
		]);
		let reads = 0;
		const cache = new DashboardVaultCache({
			getFiles: () => [...files.values()], getMarkdownFiles: () => [...files.values()],
			cachedRead: async (file: { path: string }) => { reads += 1; return file.path; },
		} as never);
		await cache.read(files.get('old.md') as never);
		await cache.read(files.get('new.md') as never);
		cache.invalidate('old.md', 'new.md');
		await cache.read(files.get('old.md') as never);
		await cache.read(files.get('new.md') as never);
		expect(reads).toBe(4);
		cache.clear();
		expect(cache.allFiles()).toHaveLength(2);
	});
});
