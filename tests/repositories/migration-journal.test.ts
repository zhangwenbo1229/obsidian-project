import { describe, expect, it } from 'vitest';
import { MigrationJournal } from '../../src/repositories/migration-journal';
import type { VaultAdapter } from '../../src/repositories';

class MemoryVault implements VaultAdapter {
	files = new Map<string, string>();
	async exists(path: string) { return this.files.has(path); }
	async read(path: string) { return this.files.get(path) ?? ''; }
	async create(path: string, content: string) { this.files.set(path, content); }
	async process(path: string, update: (content: string) => string) { this.files.set(path, update(await this.read(path))); }
	async listMarkdownFiles() { return []; }
	async listFiles(directory: string) { return [...this.files.keys()].filter((path) => path.startsWith(`${directory}/`)); }
	async rename() {}
	async trash() {}
	async ensureFolder() {}
}

describe('migration journal', () => {
	it('persists completed items so an interrupted migration can continue', async () => {
		const vault = new MemoryVault();
		const journal = new MigrationJournal(vault, 'migration-1');
		await journal.create('project-code', [{ uid: 'task-1', oldPath: 'a.md', newPath: 'b.md' }]);
		await journal.complete('task-1');
		const state = await journal.read();
		expect(state.items[0]).toMatchObject({ uid: 'task-1', completed: true });
	});

	it('lists unfinished journals and persists finalization progress', async () => {
		const vault = new MemoryVault();
		const journal = new MigrationJournal(vault, 'migration-2');
		await journal.create(
			'project-code',
			[{ uid: 'task-1', oldPath: 'a.md', newPath: 'b.md' }],
			{ type: 'project-code', projectUid: 'project-1', oldPath: 'OLD.md', newPath: 'NEW.md', project: {} as never },
		);
		await journal.complete('task-1');

		expect((await MigrationJournal.listIncomplete(vault)).map((state) => state.id)).toEqual(['migration-2']);
		await journal.completeFinalization();
		expect(await MigrationJournal.listIncomplete(vault)).toEqual([]);
	});
});
