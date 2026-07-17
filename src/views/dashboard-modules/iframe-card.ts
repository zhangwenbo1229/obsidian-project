import type { IframeDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { renderIframeSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

function renderIframe(context: DashboardModuleRenderContext): void {
	const body = createModuleBody(context.container, 'op-iframe-card');
	const config = context.card.moduleConfig as IframeDashboardModuleConfig;
	if (!config.url) {
		renderModuleMessage(body, 'panels-top-left', '未配置网页', '右键打开卡片设置，输入需要嵌入的网页地址。');
		return;
	}
	const iframe = body.createEl('iframe', {
		cls: 'op-iframe-card-frame',
		attr: {
			src: config.url,
			sandbox: 'allow-forms allow-popups allow-scripts allow-same-origin',
			referrerpolicy: 'no-referrer',
			loading: 'lazy',
			title: context.card.title ?? '网页卡片',
		},
	});
	const syncSize = (): void => {
		const width = body.clientWidth;
		const height = body.clientHeight;
		if (width > 0) iframe.style.width = `${width}px`;
		if (height > 0) iframe.style.height = `${height}px`;
	};
	syncSize();
	const ResizeObserver = body.ownerDocument.defaultView?.ResizeObserver;
	if (ResizeObserver) {
		const observer = new ResizeObserver(syncSize);
		observer.observe(body);
		context.component.register(() => observer.disconnect());
	}
}

export const iframeDefinition: DashboardModuleDefinition = {
	kind: 'iframe',
	label: '网页',
	icon: 'panels-top-left',
	render: renderIframe,
	renderSettings: renderIframeSettings,
};
