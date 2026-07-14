import { setIcon } from 'obsidian';
import type { NoteStatsDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, formatCompactNumber, renderModuleMessage } from './card-ui';
import { renderNoteStatsSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { collectNoteStatistics } from './vault-data';

async function renderNoteStats(context: DashboardModuleRenderContext): Promise<void> {
	const body = createModuleBody(context.container, 'op-note-stats-card');
	renderModuleMessage(body, 'loader-circle', '正在统计', '正在读取所选范围内的 Markdown 笔记。', 'op-dashboard-module-loading');
	const config = context.card.moduleConfig as NoteStatsDashboardModuleConfig;
	const files = context.manager.app.vault.getMarkdownFiles();
	const stats = await collectNoteStatistics(
		files,
		(file) => context.manager.app.vault.cachedRead(file),
		config.rootPath,
		config.topFolderLimit,
	);
	if (!context.isCurrent()) return;
	body.empty();
	const grid = body.createDiv({ cls: 'op-note-stats-grid' });
	for (const item of [
		{ label: '笔记', value: stats.noteCount, icon: 'notebook-tabs' },
		{ label: '字符', value: stats.characterCount, icon: 'text-cursor-input' },
		{ label: '目录', value: stats.folderCount, icon: 'folders' },
	]) {
		const tile = grid.createDiv({ cls: 'op-note-stats-tile' });
		const icon = tile.createSpan({ cls: 'op-note-stats-icon' });
		setIcon(icon, item.icon);
		tile.createEl('strong', { text: formatCompactNumber(item.value) });
		tile.createSpan({ text: item.label });
	}
	if (stats.topFolders.length > 0) {
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
