import { MarkdownRenderer } from 'obsidian';
import type { TextDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { renderTextSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { updateDashboardCard } from '../dashboard-layout';

async function renderText(context: DashboardModuleRenderContext): Promise<void> {
	const body = createModuleBody(context.container, 'op-text-card');
	const config = context.card.moduleConfig as TextDashboardModuleConfig;
	if (!config.markdown.trim()) {
		renderModuleMessage(body, 'notebook-pen', '文本为空', '右键打开卡片设置，输入 Markdown 内容。');
		return;
	}
	await MarkdownRenderer.render(context.manager.app, config.markdown, body, '', context.component);
	body.addEventListener('dblclick', () => {
		const textarea = context.container.createEl('textarea', {
			cls: 'op-text-card-inline-editor', attr: { rows: '8', 'aria-label': '编辑文本卡片' },
		});
		textarea.value = config.markdown;
		body.hidden = true;
		textarea.focus();
		let finished = false;
		const cancel = () => {
			if (finished) return;
			finished = true;
			textarea.remove();
			body.hidden = false;
		};
		const save = async () => {
			if (finished) return;
			finished = true;
			try {
				await context.manager.savePersonalDashboardLayout(updateDashboardCard(
					context.manager.personalDashboardLayout,
					context.card.id,
					{ moduleConfig: { ...config, markdown: textarea.value } },
				));
				context.refresh();
			} catch {
				finished = false;
				textarea.focus();
			}
		};
		textarea.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') cancel();
			else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				void save();
			}
		});
		textarea.addEventListener('blur', () => void save());
	});
}

export const textDefinition: DashboardModuleDefinition = {
	kind: 'text',
	label: '文本',
	icon: 'notebook-pen',
	render: renderText,
	renderSettings: renderTextSettings,
};
