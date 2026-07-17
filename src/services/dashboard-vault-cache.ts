import type { TFile, Vault } from 'obsidian';

type DashboardVault = Pick<Vault, 'getFiles' | 'getMarkdownFiles' | 'cachedRead'>;

interface ContentEntry {
	mtime: number;
	promise: Promise<string>;
}

export class DashboardVaultCache {
	private files: TFile[] | null = null;
	private markdown: TFile[] | null = null;
	private readonly content = new Map<string, ContentEntry>();

	constructor(private readonly vault: DashboardVault) {}

	allFiles(): readonly TFile[] {
		this.files ??= this.vault.getFiles();
		return this.files;
	}

	markdownFiles(): readonly TFile[] {
		this.markdown ??= this.vault.getMarkdownFiles();
		return this.markdown;
	}

	read(file: TFile): Promise<string> {
		const existing = this.content.get(file.path);
		if (existing?.mtime === file.stat.mtime) return existing.promise;
		const promise = this.vault.cachedRead(file).catch((error: unknown) => {
			if (this.content.get(file.path)?.promise === promise) this.content.delete(file.path);
			throw error;
		});
		this.content.set(file.path, { mtime: file.stat.mtime, promise });
		return promise;
	}

	invalidate(...paths: string[]): void {
		this.files = null;
		this.markdown = null;
		for (const path of paths) if (path) this.content.delete(path);
	}

	clear(): void {
		this.files = null;
		this.markdown = null;
		this.content.clear();
	}
}
