import { setIcon } from 'obsidian';
import type { DirectoryDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { renderDirectorySettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { buildDirectoryTree, type DirectoryTreeNode } from './vault-data';

function renderTreeNode(parent: HTMLElement, node: DirectoryTreeNode, context: DashboardModuleRenderContext): void {
	if (node.kind === 'file') {
		const button = parent.createEl('button', { cls: 'op-directory-file', attr: { type: 'button', title: node.path } });
		const icon = button.createSpan();
		setIcon(icon, 'file-text');
		button.createSpan({ text: node.name });
		button.addEventListener('click', () => {
			const file = context.manager.app.vault.getFileByPath(node.path);
			if (file) void context.manager.app.workspace.getLeaf(false).openFile(file);
		});
		return;
	}
	const details = parent.createEl('details', { cls: 'op-directory-folder' });
	details.open = parent.classList.contains('op-directory-tree');
	const summary = details.createEl('summary');
	const icon = summary.createSpan();
	setIcon(icon, 'folder');
	summary.createSpan({ text: node.name });
	const children = details.createDiv({ cls: 'op-directory-children' });
	for (const child of node.children) renderTreeNode(children, child, context);
}

function renderDirectory(context: DashboardModuleRenderContext): void {
	const body = createModuleBody(context.container, 'op-directory-card');
	const config = context.card.moduleConfig as DirectoryDashboardModuleConfig;
	const tree = buildDirectoryTree(context.manager.app.vault.getMarkdownFiles(), config.rootPaths, config.maxDepth);
	if (tree.length === 0) {
		renderModuleMessage(body, 'folder-open', '目录为空', '调整根目录配置，或先创建 Markdown 笔记。');
		return;
	}
	const root = body.createDiv({ cls: 'op-directory-tree' });
	for (const node of tree) renderTreeNode(root, node, context);
}

export const directoryDefinition: DashboardModuleDefinition = {
	kind: 'directory',
	label: '目录',
	icon: 'folder-tree',
	render: renderDirectory,
	renderSettings: renderDirectorySettings,
};
