import { requestUrl } from 'obsidian';
import type { IpDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, createHeadingButton, renderModuleMessage } from './card-ui';
import type { DashboardModuleDefinition, DashboardModuleRenderContext, DashboardModuleSettingsContext } from './types';
import { Setting } from 'obsidian';

interface GeoLocation {
	country: string;
	region: string;
	city: string;
	isp: string;
}

// ip-api.com 的 lang=zh-CN 不会翻译运营商字段，需要手动映射
const ISP_CN_MAP: Record<string, string> = {
	'China Mobile communications corporation': '中国移动',
	'China Mobile': '中国移动',
	'China Telecom': '中国电信',
	'China Unicom': '中国联通',
	'China TieTong': '中国铁通',
	'China Railcom': '中国铁通',
	'Dr. Peng Telecom & Media Group': '鹏博士',
	'Dr. Peng Telecom & Media': '鹏博士',
	'China Education and Research Network': '中国教育网',
	'CERNET': '中国教育网',
	'Beijing Teletron Telecom': '北京电信通',
	'Great Wall Broadband Network': '长城宽带',
	'Tencent Cloud Computing': '腾讯云',
	'Tencent Cloud': '腾讯云',
	'Alibaba (China) Technology': '阿里巴巴',
	'Alibaba Cloud': '阿里云',
	'Huawei Cloud': '华为云',
	'China Broadcasting Network': '中国广电',
	'Baidu': '百度',
	'JD Cloud': '京东云',
	'Beijing Qihu Technology': '360',
};

function translateIsp(isp: string): string {
	if (!isp) return '';
	return ISP_CN_MAP[isp] ?? isp;
}

let cachedIp: string | null = null;
let cachedGeo: GeoLocation | null = null;
let lastFetchTime = 0;

async function fetchPublicIp(): Promise<string> {
	const now = Date.now();
	if (cachedIp && now - lastFetchTime < 60_000) return cachedIp;

	// 首选：api.ip.sb/geoip 返回 JSON，同时包含 IP 和地理位置
	try {
		const response = await requestUrl({ url: 'https://api.ip.sb/geoip' });
		if (response.status >= 200 && response.status < 300) {
			const data = response.json as Record<string, string>;
			const ip = data.ip;
			if (ip && typeof ip === 'string' && ip.trim()) {
				cachedIp = ip.trim();
				lastFetchTime = now;
				// 不缓存 geo，后续 fetchGeoLocation 用 ip-api.com 获取中文地名
				return cachedIp;
			}
		}
	} catch { /* fall through */ }

	// 备用：icanhazip.com 返回纯文本，需用 fetch 避免 requestUrl 的 JSON 解析报错
	try {
		const r = await fetch('https://icanhazip.com');
		if (r.ok) {
			const ip = (await r.text()).trim();
			if (ip) {
				cachedIp = ip;
				lastFetchTime = now;
				return cachedIp;
			}
		}
	} catch { /* fall through */ }

	throw new Error('所有 IP 服务均不可用');
}

async function fetchGeoLocation(ip: string): Promise<GeoLocation> {
	if (cachedGeo && Date.now() - lastFetchTime < 300_000) return cachedGeo;
	// api.ip.sb/geoip 已经在 fetchPublicIp 中返回了 geo 数据
	if (cachedGeo) return cachedGeo;
	try {
		const response = await requestUrl({ url: `http://ip-api.com/json/${ip}?lang=zh-CN&fields=country,regionName,city,isp` });
		if (response.status < 200 || response.status >= 300) throw new Error('地理位置查询失败');
		const data = response.json as Record<string, string>;
		cachedGeo = {
			country: data.country || '',
			region: data.regionName || '',
			city: data.city || '',
			isp: translateIsp(data.isp || ''),
		};
		return cachedGeo;
	} catch {
		cachedGeo = null;
		throw new Error('地理位置服务不可用');
	}
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
	let geoRow: HTMLDivElement | null = null;

	const refresh = async (): Promise<void> => {
		if (!context.isCurrent()) return;
		try {
			status.textContent = '获取中...';
			status.className = 'op-ip-status is-loading';
			const ip = await fetchPublicIp();
			value.textContent = ip;
			status.textContent = '已连接';
			status.className = 'op-ip-status is-connected';
			if (config.showGeoLocation) {
				try {
					const geo = await fetchGeoLocation(ip);
					if (!geoRow) {
						geoRow = body.createDiv({ cls: 'op-ip-geo' });
					}
					geoRow.empty();
					const parts = [geo.country, geo.region, geo.city].filter(Boolean);
					if (parts.length > 0) {
						geoRow.createSpan({ cls: 'op-ip-geo-location', text: parts.join(' · ') });
					}
					if (geo.isp) {
						geoRow.createSpan({ cls: 'op-ip-geo-isp', text: geo.isp });
					}
				} catch {
					if (geoRow) geoRow.remove();
					geoRow = null;
				}
			} else {
				if (geoRow) { geoRow.remove(); geoRow = null; }
			}
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
	header.createEl('p', { text: '通过 httpbin.org、ipify.org 等稳定服务获取公网 IP，自动多源容错。地理位置通过 ip-api.com 查询。' });

	new Setting(context.container)
		.setName('允许联网获取 IP')
		.setDesc('开启后，卡片会向 ip-api.com 等服务发送请求。不发送任何库或笔记内容。')
		.addToggle((toggle) => toggle.setValue(config.networkEnabled).onChange((networkEnabled) => update({ networkEnabled })));

	new Setting(context.container)
		.setName('显示地理位置')
		.setDesc('通过 ip-api.com 查询 IP 对应的国家、地区、城市和运营商。')
		.addToggle((toggle) => toggle.setValue(config.showGeoLocation).onChange((showGeoLocation) => update({ showGeoLocation })));

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