import { requestUrl } from 'obsidian';
import type { IpDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, createHeadingButton, renderModuleMessage } from './card-ui';
import type { DashboardModuleDefinition, DashboardModuleRenderContext, DashboardModuleSettingsContext } from './types';
import { Setting } from 'obsidian';

const IP_APIS = [
	{ url: 'https://httpbin.org/ip', parse: (data: { origin: string }) => data.origin },
	{ url: 'https://icanhazip.com', parse: (text: string) => text.trim() },
	{ url: 'https://api.ipify.org?format=json', parse: (data: { ip: string }) => data.ip },
];

let cachedIp: string | null = null;
let lastFetchTime = 0;

async function fetchPublicIp(): Promise<string> {
	const now = Date.now();
	if (cachedIp && now - lastFetchTime < 60_000) return cachedIp;

	for (const { url, parse } of IP_APIS) {
		try {
			const response = await requestUrl({ url });
			if (response.status < 200 || response.status >= 300) continue;
			const json = response.json as Record<string, unknown> | null;
			const ip = json ? parse(json as never) : parse(response.text as never);
			if (ip && typeof ip === 'string' && ip.trim()) {
				cachedIp = ip.trim();
				lastFetchTime = now;
				return cachedIp;
			}
		} catch {
			// try next API
		}
	}
	throw new Error('所有 IP 服务均不可用');
}

function renderIp(context: DashboardModuleRenderContext): void {
	const config = context.card.moduleConfig as IpDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-ip-card');

	if (!config.networkEnabled) {
		renderModuleMessage(body, 'shield-off', '未开启联网', '右键打开卡片设置，开启联网获取公网 IP。');
		return;
	}

	const ipDisplay = body.createDiv({ cls: 'op-ip-display' });
	ipDisplay.createSpan({ cls: 'op-ip-label', text: '公网 IP' });
	const value = ipDisplay.createEl('strong', { cls: 'op-ip-value', text: '' });
	const status = ipDisplay.createDiv({ cls: 'op-ip-status' });

	const refresh = async (): Promise<void> => {
		if (!context.isCurrent()) return;
		try {
			status.textContent = '获取中...';
			status.className = 'op-ip-status is-loading';
			const ip = await fetchPublicIp();
			value.textContent = ip;
			status.textContent = '已连接';
			status.className = 'op-ip-status is-connected';
		} catch (error) {
			status.textContent = error instanceof Error ? error.message : '获取失败';
			status.className = 'op-ip-status is-error';
		}
	};

	void refresh();

	createHeadingButton(context.heading, 'refresh-cw', '刷新', () => {
		void refresh();
	});

	if (config.refreshMinutes > 0) {
		const interval = window.setInterval(() => {
			if (context.isCurrent()) void refresh();
		}, config.refreshMinutes * 60_000);
		context.component.registerInterval(interval);
	}
}

function renderIpSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as IpDashboardModuleConfig;
	const update = (patch: Partial<IpDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };

	const header = context.container.createDiv({ cls: 'op-dashboard-module-settings-header' });
	header.createEl('h3', { text: '公网 IP' });
	header.createEl('p', { text: '通过 api.ip.sb、ipify.org 等稳定服务获取公网 IP，自动多源容错。' });

	new Setting(context.container)
		.setName('允许联网获取 IP')
		.setDesc('开启后，卡片会向 api.ip.sb 等服务发送请求。不发送任何库或笔记内容。')
		.addToggle((toggle) => toggle.setValue(config.networkEnabled).onChange((networkEnabled) => update({ networkEnabled })));

	new Setting(context.container).setName('刷新间隔').setDesc('0 表示不自动刷新；1–360 分钟。').addSlider((slider) => slider
		.setLimits(0, 360, 5)
		.setDynamicTooltip()
		.setValue(config.refreshMinutes)
		.onChange((refreshMinutes) => update({ refreshMinutes })));
}

export const ipDefinition: DashboardModuleDefinition = {
	kind: 'ip',
	label: '公网 IP',
	icon: 'globe',
	render: renderIp,
	renderSettings: renderIpSettings,
};