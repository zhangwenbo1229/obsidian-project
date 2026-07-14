export interface DashboardVaultFile {
	path: string;
	basename: string;
	stat: {
		mtime: number;
		ctime: number;
		size: number;
	};
}

export interface NoteStatistics {
	noteCount: number;
	characterCount: number;
	folderCount: number;
	topFolders: Array<{ path: string; count: number }>;
}

export interface DirectoryTreeNode {
	name: string;
	path: string;
	kind: 'folder' | 'file';
	children: DirectoryTreeNode[];
}

function normalizeRoot(rootPath: string): string {
	return rootPath.trim().replace(/^\/+|\/+$/gu, '');
}

function belongsToRoot(path: string, rootPath: string): boolean {
	const root = normalizeRoot(rootPath);
	return !root || path === root || path.startsWith(`${root}/`);
}

export function filterFilesByRoot<T extends DashboardVaultFile>(files: readonly T[], rootPath: string): T[] {
	return files.filter((file) => belongsToRoot(file.path, rootPath));
}

export function filterFilesByScope<T extends DashboardVaultFile>(
	files: readonly T[],
	rootPath: string,
	excludePaths: readonly string[],
): T[] {
	const exclusions = [...new Set(excludePaths.map(normalizeRoot).filter(Boolean))];
	return files.filter((file) => belongsToRoot(file.path, rootPath) && !exclusions.some((path) => belongsToRoot(file.path, path)));
}

export function selectRecentFiles<T extends DashboardVaultFile>(
	files: readonly T[],
	rootPath: string,
	limit: number,
	excludePaths: readonly string[] = [],
): T[] {
	return filterFilesByScope(files, rootPath, excludePaths)
		.sort((left, right) => right.stat.mtime - left.stat.mtime || left.path.localeCompare(right.path, 'zh-CN'))
		.slice(0, Math.max(0, limit));
}

export async function collectNoteStatistics<T extends DashboardVaultFile>(
	files: readonly T[],
	read: (file: T) => Promise<string>,
	rootPath: string,
	topFolderLimit: number,
	excludePaths: readonly string[] = [],
): Promise<NoteStatistics> {
	const selected = filterFilesByScope(files, rootPath, excludePaths);
	const contents = await Promise.all(selected.map((file) => read(file)));
	const folders = new Set<string>();
	const topFolders = new Map<string, number>();
	const normalizedRoot = normalizeRoot(rootPath);
	for (const file of selected) {
		const segments = file.path.split('/').slice(0, -1);
		for (let index = 0; index < segments.length; index += 1) {
			folders.add(segments.slice(0, index + 1).join('/'));
		}
		const relative = normalizedRoot && belongsToRoot(file.path, normalizedRoot)
			? file.path.slice(normalizedRoot.length).replace(/^\//u, '')
			: file.path;
		const firstFolder = relative.includes('/') ? relative.split('/')[0]! : normalizedRoot || '根目录';
		const displayPath = normalizedRoot
			? (firstFolder === '根目录' ? normalizedRoot : `${normalizedRoot}/${firstFolder}`)
			: firstFolder;
		topFolders.set(displayPath, (topFolders.get(displayPath) ?? 0) + 1);
	}
	return {
		noteCount: selected.length,
		characterCount: contents.reduce((total, content) => total + content.length, 0),
		folderCount: folders.size,
		topFolders: [...topFolders.entries()]
			.map(([path, count]) => ({ path, count }))
			.sort((left, right) => right.count - left.count || left.path.localeCompare(right.path, 'zh-CN'))
			.slice(0, Math.max(0, topFolderLimit)),
	};
}

function sortTree(nodes: DirectoryTreeNode[]): DirectoryTreeNode[] {
	return nodes.sort((left, right) => {
		if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
		return left.name.localeCompare(right.name, 'zh-CN');
	});
}

export function buildDirectoryTree<T extends DashboardVaultFile>(
	files: readonly T[],
	rootPaths: readonly string[],
	maxDepth: number,
): DirectoryTreeNode[] {
	const normalizedRoots = [...new Set(rootPaths.map(normalizeRoot).filter(Boolean))];
	if (normalizedRoots.length === 0) {
		const virtualRoot: DirectoryTreeNode = { name: '', path: '', kind: 'folder', children: [] };
		for (const file of files) {
			const segments = file.path.split('/').filter(Boolean);
			let parent = virtualRoot;
			let currentPath = '';
			for (const [index, segment] of segments.entries()) {
				if (index + 1 > maxDepth) break;
				currentPath = currentPath ? `${currentPath}/${segment}` : segment;
				const isFile = index === segments.length - 1;
				let node = parent.children.find((item) => item.path === currentPath);
				if (!node) {
					node = {
						name: isFile ? segment.replace(/\.md$/iu, '') : segment,
						path: currentPath,
						kind: isFile ? 'file' : 'folder',
						children: [],
					};
					parent.children.push(node);
				}
				parent = node;
			}
		}
		const visit = (node: DirectoryTreeNode) => {
			sortTree(node.children);
			for (const child of node.children) visit(child);
		};
		visit(virtualRoot);
		return virtualRoot.children;
	}
	const effectiveRoots = normalizedRoots;
	const roots: DirectoryTreeNode[] = [];
	for (const root of effectiveRoots) {
		const rootNode: DirectoryTreeNode = {
			name: root.split('/').at(-1) ?? root,
			path: root,
			kind: 'folder',
			children: [],
		};
		for (const file of files.filter((item) => belongsToRoot(item.path, root))) {
			const relativeSegments = file.path.slice(root.length).replace(/^\//u, '').split('/').filter(Boolean);
			let parent = rootNode;
			let currentPath = root;
			for (const [index, segment] of relativeSegments.entries()) {
				const level = index + 2;
				if (level > maxDepth) break;
				currentPath = `${currentPath}/${segment}`;
				const isFile = index === relativeSegments.length - 1;
				let node = parent.children.find((item) => item.path === currentPath);
				if (!node) {
					node = {
						name: isFile ? segment.replace(/\.md$/iu, '') : segment,
						path: currentPath,
						kind: isFile ? 'file' : 'folder',
						children: [],
					};
					parent.children.push(node);
				}
				parent = node;
			}
		}
		const visit = (node: DirectoryTreeNode) => {
			sortTree(node.children);
			for (const child of node.children) visit(child);
		};
		visit(rootNode);
		roots.push(rootNode);
	}
	return sortTree(roots);
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
	const elapsed = Math.max(0, now - timestamp);
	if (elapsed < 60_000) return '刚刚';
	if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`;
	if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
	if (elapsed < 7 * 86_400_000) return `${Math.floor(elapsed / 86_400_000)} 天前`;
	return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}
