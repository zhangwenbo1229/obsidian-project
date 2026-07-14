import { setIcon } from 'obsidian';
import type { RecentFilesDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { renderRecentFilesSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { formatRelativeTime, selectRecentFiles } from './vault-data';

function renderRecentFiles(context: DashboardModuleRenderContext): void {
	const body = createModuleBody(context.container, 'op-recent-files-card');
	const config = context.card.moduleConfig as RecentFilesDashboardModuleConfig;
	const files = selectRecentFiles(context.manager.app.vault.getMarkdownFiles(), config.rootPath, config.limit, config.excludePaths);
	if (files.length === 0) {
		renderModuleMessage(body, 'file-clock', '暂无最近文件', '所选目录中还没有 Markdown 笔记。');
		return;
	}
	const list = body.createDiv({ cls: 'op-recent-files-list' });
	for (const file of files) {
		const button = list.createEl('button', { cls: 'op-recent-file', attr: { type: 'button', title: file.path } });
		const icon = button.createSpan({ cls: 'op-recent-file-icon' });
		setIcon(icon, 'file-text');
		const copy = button.createSpan({ cls: 'op-recent-file-copy' });
		copy.createEl('strong', { text: file.basename });
		copy.createSpan({ text: file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '根目录' });
		button.createSpan({ cls: 'op-recent-file-time', text: formatRelativeTime(file.stat.mtime) });
		button.addEventListener('click', () => void context.manager.app.workspace.getLeaf(false).openFile(file));
	}
}

export const recentFilesDefinition: DashboardModuleDefinition = {
	kind: 'recent-files',
	label: '最近文件',
	icon: 'history',
	render: renderRecentFiles,
	renderSettings: renderRecentFilesSettings,
};
