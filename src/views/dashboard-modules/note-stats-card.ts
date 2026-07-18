import { setIcon, type TFile } from 'obsidian';
import type { NoteMetadataFilter, NoteStatsDashboardModuleConfig, NoteStatsDisplayField } from '../../domain/types';
import { createModuleBody, formatCompactNumber, renderModuleMessage } from './card-ui';
import { renderNoteStatsSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { collectNoteStatistics, countFilteredFiles } from './vault-data';

const METRIC_ICONS: Record<NoteStatsDisplayField, string> = {
	noteCount: 'files',
	characterCount: 'text-cursor-input',
	folderCount: 'folders',
	totalSize: 'database',
	topFolders: 'folder-tree',
};

async function computeMetricValue(
	fieldType: NoteStatsDisplayField,
	files: ReturnType<DashboardModuleRenderContext['manager']['dashboardVaultCache']['allFiles']>,
	rootPath: string,
	excludePaths: string[],
	extensions: string[],
	metadataFilters: NoteMetadataFilter[],
	context: DashboardModuleRenderContext,
): Promise<number> {
	const filter = {
		extensions,
		metadataKey: '',
		metadataValue: '',
		metadataFilters,
		frontmatter: (file: { path: string }) => context.manager.app.metadataCache.getFileCache(file as unknown as TFile)?.frontmatter,
	};
	if (fieldType === 'noteCount') {
		return countFilteredFiles(files, rootPath, excludePaths, filter);
	}
	if (fieldType === 'characterCount') {
		const filtered = files.filter((f) => {
			if (rootPath && !f.path.startsWith(rootPath)) return false;
			if (excludePaths.some((p) => f.path.startsWith(p))) return false;
			const ext = f.path.includes('.') ? f.path.split('.').at(-1)?.toLowerCase() ?? '' : '';
			if (extensions.length > 0 && !extensions.includes(ext)) return false;
			if (filter.metadataFilters.length > 0) {
				const fm = filter.frontmatter(f);
				if (!fm) return true;
				for (const mf of filter.metadataFilters) {
					const val = fm[mf.key];
					const strVal = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : '';
					if (mf.mode === 'include' && !mf.values.includes(strVal)) return false;
					if (mf.mode === 'exclude' && mf.values.includes(strVal)) return false;
				}
			}
			return true;
		});
		let total = 0;
		for (const f of filtered) {
			try {
				const content = await context.manager.dashboardVaultCache.read(f).catch(() => '');
				total += content.length;
			} catch {
				// skip
			}
		}
		return total;
	}
	if (fieldType === 'folderCount') {
		const folders = new Set<string>();
		for (const f of files) {
			if (rootPath && !f.path.startsWith(rootPath)) continue;
			if (excludePaths.some((p) => f.path.startsWith(p))) continue;
			const ext = f.path.includes('.') ? f.path.split('.').at(-1)?.toLowerCase() ?? '' : '';
			if (extensions.length > 0 && !extensions.includes(ext)) continue;
			if (filter.metadataFilters.length > 0) {
				const fm = filter.frontmatter(f);
				if (!fm) continue;
				let match = true;
				for (const mf of filter.metadataFilters) {
					const val = fm[mf.key];
					const strVal = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : '';
					if (mf.mode === 'include' && !mf.values.includes(strVal)) { match = false; break; }
					if (mf.mode === 'exclude' && mf.values.includes(strVal)) { match = false; break; }
				}
				if (!match) continue;
			}
			const dir = f.path.split('/').slice(0, -1).join('/') || '/';
			folders.add(dir);
		}
		return folders.size;
	}
	if (fieldType === 'totalSize') {
		const filtered = files.filter((f) => {
			if (rootPath && !f.path.startsWith(rootPath)) return false;
			if (excludePaths.some((p) => f.path.startsWith(p))) return false;
			const ext = f.path.includes('.') ? f.path.split('.').at(-1)?.toLowerCase() ?? '' : '';
			if (extensions.length > 0 && !extensions.includes(ext)) return false;
			if (filter.metadataFilters.length > 0) {
				const fm = filter.frontmatter(f);
				if (!fm) return true;
				for (const mf of filter.metadataFilters) {
					const val = fm[mf.key];
					const strVal = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : '';
					if (mf.mode === 'include' && !mf.values.includes(strVal)) return false;
					if (mf.mode === 'exclude' && mf.values.includes(strVal)) return false;
				}
			}
			return true;
		});
		return filtered.reduce((sum, f) => sum + f.stat.size, 0);
	}
	return countFilteredFiles(files, rootPath, excludePaths, filter);
}

const METRIC_LABELS: Record<NoteStatsDisplayField, string> = {
	noteCount: '文件',
	characterCount: '字符',
	folderCount: '目录',
	totalSize: '字节',
	topFolders: '分布',
};

async function renderNoteStats(context: DashboardModuleRenderContext): Promise<void> {
	const body = createModuleBody(context.container, 'op-note-stats-card');
	renderModuleMessage(body, 'loader-circle', '正在统计', '正在读取所选范围内的文件。', 'op-dashboard-module-loading');
	const config = context.card.moduleConfig as NoteStatsDashboardModuleConfig;
	const files = context.manager.dashboardVaultCache.allFiles();
	const stats = await collectNoteStatistics(
		files,
		(file) => context.manager.dashboardVaultCache.read(file).catch(() => ''),
		config.rootPath,
		config.topFolderLimit,
		config.excludePaths,
		{
			extensions: config.extensions,
			metadataKey: config.metadataKey,
			metadataValue: config.metadataValue,
			metadataFilters: config.metadataFilters ?? [],
			frontmatter: (file) => context.manager.app.metadataCache.getFileCache(file)?.frontmatter,
		},
	);
	if (!context.isCurrent()) return;
	body.empty();
	const grid = body.createDiv({ cls: 'op-note-stats-grid' });
	for (const metric of config.fileCountMetrics) {
		const tile = grid.createDiv({ cls: 'op-note-stats-tile' });
		const icon = tile.createSpan({ cls: 'op-note-stats-icon' });
		setIcon(icon, METRIC_ICONS[metric.fieldType] || 'files');
		tile.createEl('strong', { text: formatCompactNumber(await computeMetricValue(
			metric.fieldType || 'noteCount',
			files,
			metric.rootPath,
			metric.excludePaths,
			metric.extensions,
			metric.metadataFilters ?? [],
			context,
		)) });
		tile.createSpan({ text: metric.name });
	}
	const tiles = {
		noteCount: { label: '文件', value: stats.noteCount, icon: 'notebook-tabs' },
		characterCount: { label: '字符', value: stats.characterCount, icon: 'text-cursor-input' },
		folderCount: { label: '目录', value: stats.folderCount, icon: 'folders' },
		totalSize: { label: '字节', value: stats.totalSize, icon: 'database' },
	};
	for (const field of config.displayFields.filter((field) => field !== 'topFolders')) {
		const item = tiles[field];
		const tile = grid.createDiv({ cls: 'op-note-stats-tile' });
		const icon = tile.createSpan({ cls: 'op-note-stats-icon' });
		setIcon(icon, item.icon);
		tile.createEl('strong', { text: formatCompactNumber(item.value) });
		tile.createSpan({ text: item.label });
	}
	if (config.displayFields.includes('topFolders') && stats.topFolders.length > 0) {
		const folders = body.createDiv({ cls: 'op-note-stats-folders' });
		folders.createDiv({ cls: 'op-dashboard-module-section-label', text: '笔记分布' });
		const maximum = Math.max(...stats.topFolders.map((item) => item.count));
		for (const folder of stats.topFolders) {
			const row = folders.createDiv({ cls: 'op-note-stats-folder' });
			row.createSpan({ cls: 'op-note-stats-folder-name', text: folder.path });
			row.createSpan({ cls: 'op-note-stats-folder-bar', attr: { style: `--op-folder-ratio: ${folder.count / maximum}` } });
			row.createSpan({ cls: 'op-note-stats-folder-count', text: String(folder.count) });
		}
	}
}

export const noteStatsDefinition: DashboardModuleDefinition = {
	kind: 'note-stats',
	label: '笔记统计',
	icon: 'chart-no-axes-column-increasing',
	render: renderNoteStats,
	renderSettings: renderNoteStatsSettings,
};
