export interface VaultAdapter {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	create(path: string, content: string): Promise<void>;
	process(path: string, update: (content: string) => string): Promise<void>;
	listMarkdownFiles(): Promise<string[]>;
	listFiles(directory: string): Promise<string[]>;
	rename(path: string, nextPath: string): Promise<void>;
	trash(path: string): Promise<void>;
	ensureFolder(path: string): Promise<void>;
}
