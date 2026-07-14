import {
	App,
	normalizePath,
	TFile,
	TFolder,
} from 'obsidian';
import type { VaultAdapter } from './vault-adapter';

export class ObsidianVaultAdapter implements VaultAdapter {
	constructor(private readonly app: App) {}

	async exists(path: string): Promise<boolean> {
		const normalized = normalizePath(path);
		return this.app.vault.getAbstractFileByPath(normalized) !== null || this.app.vault.adapter.exists(normalized);
	}

	async read(path: string): Promise<string> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(normalized);
		return file instanceof TFile
			? this.app.vault.cachedRead(file)
			: this.app.vault.adapter.read(normalized);
	}

	async create(path: string, content: string): Promise<void> {
		if (isHiddenPath(path)) {
			await this.app.vault.adapter.write(normalizePath(path), content);
			return;
		}
		await this.app.vault.create(normalizePath(path), content);
	}

	async process(
		path: string,
		update: (content: string) => string,
	): Promise<void> {
		const normalized = normalizePath(path);
		const file = this.app.vault.getAbstractFileByPath(normalized);
		if (!(file instanceof TFile)) {
			await this.app.vault.adapter.write(normalized, update(await this.app.vault.adapter.read(normalized)));
			return;
		}
		await this.app.vault.process(file, update);
	}

	async listMarkdownFiles(): Promise<string[]> {
		return this.app.vault.getMarkdownFiles().map((file) => file.path);
	}

	async listFiles(directory: string): Promise<string[]> {
		const normalized = normalizePath(directory);
		if (isHiddenPath(normalized)) {
			if (!(await this.app.vault.adapter.exists(normalized))) return [];
			return (await this.app.vault.adapter.list(normalized)).files;
		}
		return this.app.vault.getFiles()
			.map((file) => file.path)
			.filter((path) => path.startsWith(`${normalized}/`));
	}

	async rename(path: string, nextPath: string): Promise<void> {
		await this.ensureFolder(nextPath.split('/').slice(0, -1).join('/'));
		await this.app.fileManager.renameFile(this.file(path), normalizePath(nextPath));
	}

	async trash(path: string): Promise<void> {
		await this.app.fileManager.trashFile(this.file(path));
	}

	async ensureFolder(path: string): Promise<void> {
		if (!path) return;
		let current = '';
		for (const part of normalizePath(path).split('/')) {
			current = current ? `${current}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing instanceof TFolder) continue;
			if (existing) throw new Error(`${current} 已存在且不是文件夹。`);
			try {
				await this.app.vault.createFolder(current);
			} catch (error) {
				if (!(error instanceof Error) || error.message !== 'Folder already exists.') throw error;
			}
		}
	}

	private file(path: string): TFile {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (!(file instanceof TFile)) throw new Error(`文件不存在：${path}`);
		return file;
	}
}

function isHiddenPath(path: string): boolean {
	return normalizePath(path).split('/').some((part) => part.startsWith('.'));
}
