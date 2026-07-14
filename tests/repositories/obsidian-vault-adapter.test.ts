import { describe, expect, it, vi } from 'vitest';

import { ObsidianVaultAdapter } from '../../src/repositories/obsidian-vault-adapter';

describe('ObsidianVaultAdapter.ensureFolder', () => {
	it('accepts an existing hidden folder that is absent from the Vault cache', async () => {
		const createFolder = vi.fn().mockRejectedValue(new Error('Folder already exists.'));
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				createFolder,
			},
		};
		const adapter = new ObsidianVaultAdapter(app as never);

		await expect(adapter.ensureFolder('.migration')).resolves.toBeUndefined();
		expect(createFolder).toHaveBeenCalledWith('.migration');
	});

	it('reads and processes files inside hidden folders through the data adapter', async () => {
		const files = new Map<string, string>();
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				create: vi.fn(async (path: string, content: string) => files.set(path, content)),
				adapter: {
					read: vi.fn(async (path: string) => files.get(path) ?? ''),
					write: vi.fn(async (path: string, content: string) => files.set(path, content)),
					list: vi.fn(async () => ({ files: [...files.keys()], folders: [] })),
				},
			},
		};
		const adapter = new ObsidianVaultAdapter(app as never);
		const path = 'project/.migration/run.json';

		await adapter.create(path, '{"completed":false}');
		await adapter.process(path, (content) => content.replace('false', 'true'));

		expect(await adapter.read(path)).toBe('{"completed":true}');
	});

	it('finds and reads a visible file before the Vault cache is ready', async () => {
		const files = new Map([['project/config.md', 'ready']]);
		const app = {
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				adapter: {
					exists: vi.fn(async (path: string) => files.has(path)),
					read: vi.fn(async (path: string) => files.get(path) ?? ''),
					write: vi.fn(async (path: string, content: string) => files.set(path, content)),
				},
			},
		};
		const adapter = new ObsidianVaultAdapter(app as never);

		expect(await adapter.exists('project/config.md')).toBe(true);
		expect(await adapter.read('project/config.md')).toBe('ready');
	});
});
