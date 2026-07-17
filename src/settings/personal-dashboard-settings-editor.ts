import { Notice, Setting } from 'obsidian';
import type { DashboardCardKind } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import {
	ALL_DASHBOARD_CARD_KINDS,
	normalizePersonalDashboardSettings,
	type PersonalDashboardSettings,
} from '../views/personal-dashboard-settings';

const CARD_KIND_LABELS: Record<DashboardCardKind, string> = {
	number: '数字卡片',
	percentage: '百分比卡片',
	'task-list': '项目卡片',
	weather: '天气卡片',
	calendar: '日历卡片',
	date: '日期卡片',
	todo: '待办卡片',
	'note-stats': '笔记统计卡片',
	'recent-files': '文件卡片',
	news: '资讯卡片',
	directory: '目录卡片',
	text: '文本卡片',
	chart: '图表卡片',
	countdown: '计时卡片',
	progress: '进度卡片',
	'check-in': '打卡卡片',
	heatmap: '热力图卡片',
	iframe: '网页卡片',
};

export class PersonalDashboardSettingsEditor {
	private value: PersonalDashboardSettings;

	constructor(private readonly manager: ProjectManager) {
		this.value = normalizePersonalDashboardSettings(manager.personalDashboardSettings);
	}

	mount(container: HTMLElement): void {
		new Setting(container)
			.setName('天气服务')
			.setDesc('天气凭据在所有天气卡片之间共享，只保存在当前库的插件 data.json 中。')
			.setHeading();
		new Setting(container).setName('和风天气接口密钥').addText((text) => {
			text.inputEl.type = 'password';
			text.setPlaceholder('Qweather API key')
				.setValue(this.value.weatherCredentials.qweatherApiKey)
				.onChange((qweatherApiKey) => {
					this.value.weatherCredentials.qweatherApiKey = qweatherApiKey;
				});
		});
		new Setting(container)
			.setName('和风天气接口主机')
			.setDesc('必须是 HTTPS 地址，例如控制台分配的 abc.re.qweatherapi.com。')
			.addText((text) => text
				.setPlaceholder('https://abc.re.qweatherapi.com')
				.setValue(this.value.weatherCredentials.qweatherApiHost)
				.onChange((qweatherApiHost) => {
					this.value.weatherCredentials.qweatherApiHost = qweatherApiHost;
				}));
		new Setting(container).setName('开放天气地图接口密钥').addText((text) => {
			text.inputEl.type = 'password';
			text.setPlaceholder('Openweathermap API key')
				.setValue(this.value.weatherCredentials.openWeatherMapApiKey)
				.onChange((openWeatherMapApiKey) => {
					this.value.weatherCredentials.openWeatherMapApiKey = openWeatherMapApiKey;
				});
		});
		new Setting(container)
			.setName('常用文件统计')
			.setDesc(`已记录 ${Object.keys(this.value.fileOpenCounts).length} 个文件的打开次数；统计从启用此版本后开始。`)
			.addButton((button) => button.setButtonText('清空统计').onClick(() => {
				this.value.fileOpenCounts = {};
			}));
		new Setting(container)
			.setName('个人仪表盘自定义卡片')
			.setDesc('只有开启的类型才会出现在个人仪表盘空白处的右键新增菜单中；已创建的卡片不会被删除。')
			.setHeading();
		const enabled = new Set(this.value.enabledCardKinds);
		for (const kind of ALL_DASHBOARD_CARD_KINDS) {
			new Setting(container)
				.setName(CARD_KIND_LABELS[kind])
				.addToggle((toggle) => toggle.setValue(enabled.has(kind)).onChange((active) => {
					if (active) enabled.add(kind);
					else enabled.delete(kind);
					this.value = {
						enabledCardKinds: ALL_DASHBOARD_CARD_KINDS.filter((candidate) => enabled.has(candidate)),
						openPersonalDashboardOnStartup: this.value.openPersonalDashboardOnStartup,
						weatherCredentials: this.value.weatherCredentials,
						fileOpenCounts: this.value.fileOpenCounts,
						checkInHistories: this.value.checkInHistories,
					};
				}));
		}
		new Setting(container).addButton((button) => button
			.setButtonText('保存个人仪表盘卡片配置')
			.setCta()
			.onClick(() => void this.manager.savePersonalDashboardSettings(this.value)
				.then(() => new Notice('个人仪表盘卡片配置已保存。'))
				.catch((error: unknown) => new Notice(error instanceof Error ? error.message : String(error)))));
	}
}
