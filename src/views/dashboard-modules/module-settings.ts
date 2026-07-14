import { Setting } from 'obsidian';
import type {
	CalendarDashboardModuleConfig,
	DirectoryDashboardModuleConfig,
	NewsDashboardModuleConfig,
	NoteStatsDashboardModuleConfig,
	RecentFilesDashboardModuleConfig,
	WeatherDashboardModuleConfig,
} from '../../domain/types';
import type { DashboardModuleSettingsContext } from './types';

function section(container: HTMLElement, title: string, description: string): void {
	const header = container.createDiv({ cls: 'op-dashboard-module-settings-header' });
	header.createEl('h3', { text: title });
	header.createEl('p', { text: description });
}

function parseNumber(value: string, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function renderWeatherSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as WeatherDashboardModuleConfig;
	const update = (patch: Partial<WeatherDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '天气数据', '使用 Open-Meteo 获取天气。只有开启后，这张卡片才会访问网络。');
	new Setting(context.container)
		.setName('允许联网获取天气')
		.setDesc('仅发送配置的经纬度，不会发送任何库、笔记或任务内容。')
		.addToggle((toggle) => toggle.setValue(config.networkEnabled).onChange((networkEnabled) => update({ networkEnabled })));
	new Setting(context.container).setName('地点名称').addText((text) => text
		.setPlaceholder('上海')
		.setValue(config.locationName)
		.onChange((locationName) => update({ locationName })));
	new Setting(context.container).setName('纬度').addText((text) => text
		.setValue(String(config.latitude))
		.onChange((value) => update({ latitude: parseNumber(value, config.latitude) })));
	new Setting(context.container).setName('经度').addText((text) => text
		.setValue(String(config.longitude))
		.onChange((value) => update({ longitude: parseNumber(value, config.longitude) })));
	new Setting(context.container).setName('刷新间隔').setDesc('10–360 分钟；也可以在卡片右上角手动刷新。').addSlider((slider) => slider
		.setLimits(10, 360, 10)
		.setDynamicTooltip()
		.setValue(config.refreshMinutes)
		.onChange((refreshMinutes) => update({ refreshMinutes })));
}

export function renderCalendarSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as CalendarDashboardModuleConfig;
	const update = (patch: Partial<CalendarDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '日历显示', '月历在卡片内部切换月份，不会修改系统日期。');
	new Setting(context.container).setName('每周起始日').addDropdown((dropdown) => dropdown
		.addOption('1', '星期一')
		.addOption('0', '星期日')
		.setValue(String(config.weekStartsOn))
		.onChange((value) => update({ weekStartsOn: value === '0' ? 0 : 1 })));
	new Setting(context.container).setName('显示农历').addToggle((toggle) => toggle
		.setValue(config.showLunar)
		.onChange((showLunar) => update({ showLunar })));
}

export function renderNoteStatsSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as NoteStatsDashboardModuleConfig;
	const update = (patch: Partial<NoteStatsDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '统计范围', '留空根目录会统计整个库，只读取 Markdown 文件。');
	new Setting(context.container).setName('根目录').addText((text) => text
		.setPlaceholder('例如：笔记/工作')
		.setValue(config.rootPath)
		.onChange((rootPath) => update({ rootPath })));
	new Setting(context.container).setName('目录排行数量').addSlider((slider) => slider
		.setLimits(1, 12, 1)
		.setDynamicTooltip()
		.setValue(config.topFolderLimit)
		.onChange((topFolderLimit) => update({ topFolderLimit })));
}

export function renderRecentFilesSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as RecentFilesDashboardModuleConfig;
	const update = (patch: Partial<RecentFilesDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '最近文件', '按 Markdown 文件的最后修改时间排序。');
	new Setting(context.container).setName('根目录').addText((text) => text
		.setPlaceholder('留空表示整个库')
		.setValue(config.rootPath)
		.onChange((rootPath) => update({ rootPath })));
	new Setting(context.container).setName('显示数量').addSlider((slider) => slider
		.setLimits(3, 30, 1)
		.setDynamicTooltip()
		.setValue(config.limit)
		.onChange((limit) => update({ limit })));
}

export function renderNewsSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as NewsDashboardModuleConfig;
	const update = (patch: Partial<NewsDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '资讯订阅', '支持 RSS 与 Atom。内容只按纯文本渲染，不加载订阅源中的脚本。');
	new Setting(context.container)
		.setName('允许联网获取资讯')
		.setDesc('仅访问下方由你填写的订阅地址。')
		.addToggle((toggle) => toggle.setValue(config.networkEnabled).onChange((networkEnabled) => update({ networkEnabled })));
	new Setting(context.container).setName('订阅地址').setDesc('每行一个完整的订阅地址，支持常见资讯源格式。').addTextArea((area) => area
		.setPlaceholder('https://example.com/feed.xml')
		.setValue(config.feedUrls.join('\n'))
		.onChange((value) => update({ feedUrls: value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) })));
	new Setting(context.container).setName('每页条数').addSlider((slider) => slider
		.setLimits(3, 12, 1)
		.setDynamicTooltip()
		.setValue(config.pageSize)
		.onChange((pageSize) => update({ pageSize })));
	new Setting(context.container).setName('刷新间隔').addSlider((slider) => slider
		.setLimits(10, 360, 10)
		.setDynamicTooltip()
		.setValue(config.refreshMinutes)
		.onChange((refreshMinutes) => update({ refreshMinutes })));
}

export function renderDirectorySettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as DirectoryDashboardModuleConfig;
	const update = (patch: Partial<DirectoryDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '目录范围', '每行一个根目录；留空时显示库中包含 Markdown 笔记的一级目录。');
	new Setting(context.container).setName('根目录').addTextArea((area) => area
		.setPlaceholder('项目\n知识库')
		.setValue(config.rootPaths.join('\n'))
		.onChange((value) => update({ rootPaths: value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) })));
	new Setting(context.container).setName('最大层级').addSlider((slider) => slider
		.setLimits(1, 8, 1)
		.setDynamicTooltip()
		.setValue(config.maxDepth)
		.onChange((maxDepth) => update({ maxDepth })));
}
