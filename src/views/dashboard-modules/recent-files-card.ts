import { setIcon } from 'obsidian';
import type { RecentFilesDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { renderRecentFilesSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { formatRelativeTime, selectDashboardFiles } from './vault-data';

function renderRecentFiles(context: DashboardModuleRenderContext): void {
	const body = createModuleBody(context.container, 'op-recent-files-card');
	const config = context.card.moduleConfig as RecentFilesDashboardModuleConfig;
	const files = selectDashboardFiles(
		context.manager.app.vault.getFiles(),
		config.rootPath,
		config.limit,
		config.excludePaths,
		config.mode,
		context.manager.personalDashboardSettings.fileOpenCounts,
	);
	if (files.length === 0) {
		renderModuleMessage(body, 'file-clock', '暂无文件', '所选目录中还没有文件。');
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
		const suffix = config.mode === 'frequently-opened'
			? `${context.manager.personalDashboardSettings.fileOpenCounts[file.path] ?? 0} 次`
			: formatRelativeTime(config.mode === 'recent-created' ? file.stat.ctime : file.stat.mtime);
		button.createSpan({ cls: 'op-recent-file-time', text: suffix });
		button.addEventListener('click', () => void context.manager.app.workspace.getLeaf(false).openFile(file));
	}
}

export const recentFilesDefinition: DashboardModuleDefinition = {
	kind: 'recent-files',
	label: '文件',
	icon: 'files',
	render: renderRecentFiles,
	renderSettings: renderRecentFilesSettings,
};
