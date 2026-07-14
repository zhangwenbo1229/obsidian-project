import { MarkdownRenderer } from 'obsidian';
import type { TextDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { renderTextSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

async function renderText(context: DashboardModuleRenderContext): Promise<void> {
	const body = createModuleBody(context.container, 'op-text-card');
	const config = context.card.moduleConfig as TextDashboardModuleConfig;
	if (!config.markdown.trim()) {
		renderModuleMessage(body, 'notebook-pen', '文本为空', '右键打开卡片设置，输入 Markdown 内容。');
		return;
	}
	await MarkdownRenderer.render(context.manager.app, config.markdown, body, '', context.component);
}

export const textDefinition: DashboardModuleDefinition = {
	kind: 'text',
	label: '文本',
	icon: 'notebook-pen',
	render: renderText,
	renderSettings: renderTextSettings,
};
