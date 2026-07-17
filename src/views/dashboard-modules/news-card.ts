import { requestUrl, setIcon } from 'obsidian';
import type { NewsDashboardModuleConfig } from '../../domain/types';
import { createHeadingButton, createModuleBody, renderModuleMessage } from './card-ui';
import { renderNewsSettings } from './module-settings';
import { NewsService, type NewsItem, type NewsLoadResult } from './news-service';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { DashboardRequestPolicy } from './request-policy';

const newsRequests = new DashboardRequestPolicy(async (url) => (await requestUrl({ url })).text);
const newsService = new NewsService((url) => newsRequests.request(url));

function renderNewsPage(body: HTMLElement, result: NewsLoadResult, pageSize: number, requestedPage: number): void {
	body.empty();
	if (result.items.length === 0) {
		renderModuleMessage(
			body,
			'newspaper',
			'没有可显示的资讯',
			result.errors[0]?.message ?? '订阅源暂时没有条目。',
			result.errors.length > 0 ? 'op-dashboard-module-error' : 'op-dashboard-module-empty',
		);
		return;
	}
	const totalPages = Math.max(1, Math.ceil(result.items.length / pageSize));
	let page = Math.min(requestedPage, totalPages - 1);
	const content = body.createDiv({ cls: 'op-news-content' });
	const list = content.createDiv({ cls: 'op-news-list' });
	const render = () => {
		list.empty();
		const pageItems = result.items.slice(page * pageSize, (page + 1) * pageSize);
		for (const item of pageItems) renderNewsItem(list, item);
		controls.empty();
		const previous = controls.createEl('button', { text: '上一页', attr: { type: 'button' } });
		previous.disabled = page === 0;
		previous.addEventListener('click', () => { page -= 1; render(); });
		controls.createSpan({ text: `${page + 1} / ${totalPages}` });
		const next = controls.createEl('button', { text: '下一页', attr: { type: 'button' } });
		next.disabled = page >= totalPages - 1;
		next.addEventListener('click', () => { page += 1; render(); });
	};
	const controls = content.createDiv({ cls: 'op-news-pagination' });
	render();
	if (result.errors.length > 0) {
		const warning = body.createDiv({ cls: 'op-news-warning' });
		const icon = warning.createSpan();
		setIcon(icon, 'triangle-alert');
		warning.createSpan({ text: `${result.errors.length} 个订阅源获取失败` });
	}
}

function renderNewsItem(list: HTMLElement, item: NewsItem): void {
	const article = list.createEl('article', { cls: 'op-news-item' });
	const meta = article.createDiv({ cls: 'op-news-meta' });
	meta.createSpan({ text: item.feedTitle });
	if (item.publishedAt > 0) meta.createSpan({ text: new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(item.publishedAt) });
	const title = article.createEl('a', {
		cls: 'op-news-title',
		text: item.title,
		attr: { href: item.url, target: '_blank', rel: 'noopener noreferrer' },
	});
	if (!item.url) title.removeAttribute('href');
	if (item.summary) article.createEl('p', { text: item.summary });
}

async function renderNews(context: DashboardModuleRenderContext): Promise<void> {
	const config = context.card.moduleConfig as NewsDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-news-card');
	if (!config.networkEnabled) {
		renderModuleMessage(body, 'rss', '未启用联网', '右键打开卡片设置，添加订阅地址并允许联网。');
		return;
	}
	if (config.feedUrls.length === 0) {
		renderModuleMessage(body, 'list-plus', '尚未添加订阅', '在卡片设置中填写 RSS 或 Atom 地址。');
		return;
	}
	let loadGeneration = 0;
	const load = async (force = false) => {
		const currentLoad = ++loadGeneration;
		body.empty();
		renderModuleMessage(body, 'loader-circle', '正在获取资讯', `正在更新 ${config.feedUrls.length} 个订阅源。`, 'op-dashboard-module-loading');
		const result = await newsService.load(config.feedUrls, config.refreshMinutes, force);
		if (!context.isCurrent() || currentLoad !== loadGeneration) return;
		renderNewsPage(body, result, config.pageSize, 0);
	};
	createHeadingButton(context.heading, 'refresh-cw', '刷新资讯', () => void load(true));
	await load();
}

export const newsDefinition: DashboardModuleDefinition = {
	kind: 'news',
	label: '资讯',
	icon: 'newspaper',
	render: renderNews,
	renderSettings: renderNewsSettings,
};
