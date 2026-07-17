import { Component, MarkdownRenderer, Setting } from 'obsidian';
import type {
	CalendarDashboardModuleConfig,
	ChartDashboardModuleConfig,
	DirectoryDashboardModuleConfig,
	NewsDashboardModuleConfig,
	NoteStatsDashboardModuleConfig,
	RecentFilesDashboardModuleConfig,
	TextDashboardModuleConfig,
	WeatherDashboardModuleConfig,
	DateDashboardModuleConfig,
	TodoDashboardModuleConfig,
	CountdownDashboardModuleConfig,
	CheckInDashboardModuleConfig,
	HeatmapDashboardModuleConfig,
	IframeDashboardModuleConfig,
	TimeProgressDashboardModuleConfig,
} from '../../domain/types';
import type { DashboardModuleSettingsContext } from './types';
import { parseChartCsv, serializeChartData, type ChartData } from './chart-model';

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
	section(context.container, '天气数据', '选择天气数据源。只有开启后，这张卡片才会访问网络。');
	new Setting(context.container)
		.setName('允许联网获取天气')
		.setDesc('仅发送配置的经纬度，不会发送任何库、笔记或任务内容。')
		.addToggle((toggle) => toggle.setValue(config.networkEnabled).onChange((networkEnabled) => update({ networkEnabled })));
	new Setting(context.container).setName('天气数据源').addDropdown((dropdown) => dropdown
		.addOption('open-meteo', '开放气象（免密钥）')
		.addOption('qweather', '和风天气')
		.addOption('openweathermap', '开放天气地图')
		.setValue(config.provider)
		.onChange((provider) => update({ provider: provider as WeatherDashboardModuleConfig['provider'] })));
	new Setting(context.container)
		.setName('天气服务凭据')
		.setDesc('接口密钥和和风天气接口主机统一在“设置 → 个人仪表盘”中管理。');
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
	new Setting(context.container).setName('预报天数').setDesc('显示最近 1–7 天；开放天气地图免费预报最多返回约 5 天。').addSlider((slider) => slider
		.setLimits(1, 7, 1)
		.setDynamicTooltip()
		.setValue(config.forecastDays)
		.onChange((forecastDays) => update({ forecastDays })));
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
	new Setting(context.container).setName('显示节假日').addToggle((toggle) => toggle
		.setValue(config.showHolidays)
		.onChange((showHolidays) => update({ showHolidays })));
	new Setting(context.container).setName('使用打卡数据').setDesc('在对应日期显示当天的打卡次数。').addToggle((toggle) => toggle
		.setValue(config.useCheckInData).onChange((useCheckInData) => update({ useCheckInData })));
	if (config.useCheckInData) {
		renderCheckInSourceSetting(context, config.checkInCardId, (checkInCardId) => update({ checkInCardId }));
		new Setting(context.container).setName('打卡数据颜色').addColorPicker((picker) => picker
			.setValue(config.checkInColor).onChange((checkInColor) => update({ checkInColor })));
		new Setting(context.container).setName('打卡数据图标').setDesc('支持图标名称或 emoji。').addText((text) => text
			.setPlaceholder('输入图标名称').setValue(config.checkInIcon)
			.onChange((checkInIcon) => update({ checkInIcon: checkInIcon.trim() || 'badge-check' })));
	}
}

function renderCheckInSourceSetting(
	context: DashboardModuleSettingsContext,
	value: string | null,
	update: (cardId: string | null) => void,
): void {
	const cards = context.manager.personalDashboardLayout.filter((card) => card.kind === 'check-in');
	new Setting(context.container).setName('绑定打卡卡片').addDropdown((dropdown) => {
		dropdown.addOption('', '请选择打卡卡片');
		for (const card of cards) dropdown.addOption(card.id, card.title ?? `打卡卡片 ${card.order + 1}`);
		dropdown.setValue(value ?? '').onChange((cardId) => update(cardId || null));
	});
}

function pathListSetting(container: HTMLElement, name: string, description: string, value: string[], update: (paths: string[]) => void): void {
	new Setting(container).setName(name).setDesc(description).addTextArea((area) => area
		.setPlaceholder('每行一个目录')
		.setValue(value.join('\n'))
		.onChange((text) => update(text.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))));
}

export function renderDateSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as DateDashboardModuleConfig;
	const update = (patch: Partial<DateDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };
	section(context.container, '日期显示', '显示当前本地日期；“星期”对应日期单位显示。');
	for (const item of [
		['显示农历', 'showLunar'], ['显示节假日', 'showHoliday'], ['显示实时时间', 'showTime'],
		['显示星期', 'showWeekday'], ['时间显示秒', 'showSeconds'],
	] as const) {
		new Setting(context.container).setName(item[0]).addToggle((toggle) => toggle
			.setValue(config[item[1]]).onChange((value) => update({ [item[1]]: value })));
	}
}

export function renderTodoSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as TodoDashboardModuleConfig;
	const update = (patch: Partial<TodoDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };
	section(context.container, '待办范围', '自动收集指定目录中使用 Markdown 复选框编写的未完成任务。');
	pathListSetting(context.container, '包含目录', '留空表示整个库。', config.rootPaths, (rootPaths) => update({ rootPaths }));
	pathListSetting(context.container, '排除目录', '目录及其子目录均会排除。', config.excludePaths, (excludePaths) => update({ excludePaths }));
	new Setting(context.container).setName('显示数量').addSlider((slider) => slider.setLimits(1, 100, 1).setDynamicTooltip()
		.setValue(config.limit).onChange((limit) => update({ limit })));
	new Setting(context.container).setName('显示任务元数据').setDesc('显示优先级、日期和标签；颜色与图标由“设置 → 任务元数据”控制。')
		.addToggle((toggle) => toggle.setValue(config.showMetadata).onChange((showMetadata) => update({ showMetadata })));
}

export function renderCountdownSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as CountdownDashboardModuleConfig;
	const update = (patch: Partial<CountdownDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };
	section(context.container, '计时', '按本地自然日计算，可倒计未来日期或正计过去日期。');
	new Setting(context.container).setName('计时方式').addDropdown((dropdown) => dropdown
		.addOption('countdown', '倒计时')
		.addOption('countup', '正计时')
		.setValue(config.mode)
		.onChange((mode) => update({ mode: mode === 'countup' ? 'countup' : 'countdown' })));
	new Setting(context.container).setName('事件名称').addText((text) => text.setValue(config.eventName).onChange((eventName) => update({ eventName })));
	new Setting(context.container).setName(config.mode === 'countup' ? '开始日期' : '目标日期').addText((text) => {
		text.inputEl.type = 'date';
		text.setValue(config.targetDate).onChange((targetDate) => update({ targetDate }));
	});
	new Setting(context.container).setName('包含今天').addToggle((toggle) => toggle.setValue(config.includeToday).onChange((includeToday) => update({ includeToday })));
	new Setting(context.container).setName(config.mode === 'countup' ? '显示开始日期' : '显示目标日期').addToggle((toggle) => toggle.setValue(config.showTargetDate).onChange((showTargetDate) => update({ showTargetDate })));
}

export function renderTimeProgressSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as TimeProgressDashboardModuleConfig;
	const update = (patch: Partial<TimeProgressDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };
	section(context.container, '时间进度', '根据当前本地时间计算本周、本月和本年的已用进度。');
	new Setting(context.container).setName('显示本周').addToggle((toggle) => toggle
		.setValue(config.showWeek).onChange((showWeek) => update({ showWeek })));
	new Setting(context.container).setName('显示本月').addToggle((toggle) => toggle
		.setValue(config.showMonth).onChange((showMonth) => update({ showMonth })));
	new Setting(context.container).setName('显示本年').addToggle((toggle) => toggle
		.setValue(config.showYear).onChange((showYear) => update({ showYear })));
	new Setting(context.container).setName('进度颜色').addColorPicker((picker) => picker
		.setValue(config.fillColor).onChange((fillColor) => update({ fillColor })));
	new Setting(context.container).setName('轨道颜色').addColorPicker((picker) => picker
		.setValue(config.trackColor).onChange((trackColor) => update({ trackColor })));
}

export function renderHeatmapSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as HeatmapDashboardModuleConfig;
	const update = (patch: Partial<HeatmapDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };
	section(context.container, '文件变更热力图', 'Obsidian 不提供历史编辑次数，因此按每个文件当前的最后修改日期统计。');
	pathListSetting(context.container, '包含目录', '留空表示整个库。', config.rootPaths, (rootPaths) => update({ rootPaths }));
	pathListSetting(context.container, '排除目录', '目录及其子目录均会排除。', config.excludePaths, (excludePaths) => update({ excludePaths }));
	new Setting(context.container).setName('统计周期').addDropdown((dropdown) => dropdown
		.addOption('90', '最近 90 天').addOption('180', '最近 180 天').addOption('365', '最近 365 天')
		.setValue(String(config.days)).onChange((days) => update({ days: Number(days) })));
	new Setting(context.container).setName('热力颜色').addColorPicker((picker) => picker.setValue(config.color).onChange((color) => update({ color })));
	new Setting(context.container).setName('使用打卡数据').setDesc('开启后使用每天的打卡次数，不再统计文件最后修改日期。').addToggle((toggle) => toggle
		.setValue(config.useCheckInData).onChange((useCheckInData) => update({ useCheckInData })));
	if (config.useCheckInData) renderCheckInSourceSetting(context, config.checkInCardId, (checkInCardId) => update({ checkInCardId }));
}

export function renderCheckInSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as CheckInDashboardModuleConfig;
	const update = (patch: Partial<CheckInDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };
	section(context.container, '每日打卡', '数据仅保存在当前库的插件配置中，可供日历与热力图复用。');
	new Setting(context.container).setName('每日目标次数').addSlider((slider) => slider
		.setLimits(1, 20, 1).setDynamicTooltip().setValue(config.dailyTarget).onChange((dailyTarget) => update({ dailyTarget })));
	new Setting(context.container).setName('按钮文字').addText((text) => text
		.setValue(config.buttonLabel).onChange((buttonLabel) => update({ buttonLabel })));
	new Setting(context.container).setName('显示连续天数').addToggle((toggle) => toggle
		.setValue(config.showStreak).onChange((showStreak) => update({ showStreak })));
	new Setting(context.container).setName('显示累计天数').addToggle((toggle) => toggle
		.setValue(config.showTotalDays).onChange((showTotalDays) => update({ showTotalDays })));
	new Setting(context.container).setName('进度样式').addDropdown((dropdown) => dropdown
		.addOption('linear', '直线')
		.addOption('semicircle', '半圆')
		.setValue(config.progressStyle)
		.onChange((progressStyle) => update({ progressStyle: progressStyle === 'semicircle' ? 'semicircle' : 'linear' })));
}

export function renderNoteStatsSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as NoteStatsDashboardModuleConfig;
	const update = (patch: Partial<NoteStatsDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '统计范围', '留空根目录会统计整个库，文件后缀和元数据筛选只应用于当前卡片。');
	new Setting(context.container).setName('独立文件数量').setDesc('每个指标可使用不同目录、排除项、后缀和元数据筛选。').setHeading();
	const metricsContainer = context.container.createDiv({ cls: 'op-note-count-metrics' });
	const renderMetric = (metric: NoteStatsDashboardModuleConfig['fileCountMetrics'][number]) => {
		const group = metricsContainer.createDiv({ cls: 'op-note-count-metric-settings' });
		new Setting(group).setName(metric.name)
			.addText((text) => text.setPlaceholder('指标名称').setValue(metric.name).onChange((name) => {
				metric.name = name;
				update({ fileCountMetrics: [...config.fileCountMetrics] });
			}))
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除指标').onClick(() => {
				update({ fileCountMetrics: config.fileCountMetrics.filter((item) => item.id !== metric.id) });
				group.remove();
			}));
		new Setting(group).setName('根目录').addText((text) => text.setValue(metric.rootPath).onChange((rootPath) => {
			metric.rootPath = rootPath;
			update({ fileCountMetrics: [...config.fileCountMetrics] });
		}));
		new Setting(group).setName('排除目录').addTextArea((area) => area.setValue(metric.excludePaths.join('\n')).onChange((value) => {
			metric.excludePaths = value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
			update({ fileCountMetrics: [...config.fileCountMetrics] });
		}));
		new Setting(group).setName('文件后缀').addText((text) => text.setValue(metric.extensions.join(', ')).onChange((value) => {
			metric.extensions = value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean);
			update({ fileCountMetrics: [...config.fileCountMetrics] });
		}));
		new Setting(group).setName('元数据筛选')
			.addText((text) => text.setPlaceholder('属性').setValue(metric.metadataKey).onChange((metadataKey) => {
				metric.metadataKey = metadataKey;
				update({ fileCountMetrics: [...config.fileCountMetrics] });
			}))
			.addText((text) => text.setPlaceholder('值（可留空）').setValue(metric.metadataValue).onChange((metadataValue) => {
				metric.metadataValue = metadataValue;
				update({ fileCountMetrics: [...config.fileCountMetrics] });
			}));
	};
	for (const metric of config.fileCountMetrics) renderMetric(metric);
	new Setting(context.container).addButton((button) => button.setButtonText('新增文件数量指标').setIcon('plus').onClick(() => {
		const index = config.fileCountMetrics.length + 1;
		const metric = {
			id: `metric-${Date.now()}`,
			name: `文件数量 ${index}`,
			rootPath: '', excludePaths: [], extensions: ['md'], metadataKey: '', metadataValue: '',
		};
		update({ fileCountMetrics: [...config.fileCountMetrics, metric] });
		renderMetric(metric);
	}));
	new Setting(context.container).setName('根目录').addText((text) => text
		.setPlaceholder('例如：笔记/工作')
		.setValue(config.rootPath)
		.onChange((rootPath) => update({ rootPath })));
	new Setting(context.container).setName('排除目录').setDesc('每行一个相对库根目录的路径，并排除其全部子目录。').addTextArea((area) => area
		.setPlaceholder('模板\n归档')
		.setValue(config.excludePaths.join('\n'))
		.onChange((value) => update({ excludePaths: value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) })));
	new Setting(context.container).setName('目录排行数量').addSlider((slider) => slider
		.setLimits(1, 12, 1)
		.setDynamicTooltip()
		.setValue(config.topFolderLimit)
		.onChange((topFolderLimit) => update({ topFolderLimit })));
	new Setting(context.container).setName('文件后缀').setDesc('用逗号分隔，不包含点号。').addText((text) => text
		.setPlaceholder('Md, canvas')
		.setValue(config.extensions.join(', '))
		.onChange((value) => update({ extensions: value.split(',').map((item) => item.trim()).filter(Boolean) })));
	new Setting(context.container).setName('元数据属性').setDesc('留空表示不按元数据筛选。').addText((text) => text
		.setPlaceholder('Status')
		.setValue(config.metadataKey)
		.onChange((metadataKey) => update({ metadataKey })));
	new Setting(context.container).setName('元数据值').setDesc('留空表示只要求该属性存在。').addText((text) => text
		.setPlaceholder('Active')
		.setValue(config.metadataValue)
		.onChange((metadataValue) => update({ metadataValue })));
	const fieldLabels: Record<NoteStatsDashboardModuleConfig['displayFields'][number], string> = {
		noteCount: '文件数量', characterCount: '字符数量', folderCount: '目录数量', totalSize: '文件大小', topFolders: '目录分布',
	};
	new Setting(context.container).setName('显示字段').setDesc('拖拽调整顺序，勾选控制显示。').setHeading();
	const enabled = new Set(config.displayFields);
	const orderedFields = [
		...config.displayFields,
		...(Object.keys(fieldLabels) as NoteStatsDashboardModuleConfig['displayFields']).filter((field) => !enabled.has(field)),
	];
	let dragged: NoteStatsDashboardModuleConfig['displayFields'][number] | null = null;
	for (const field of orderedFields) {
		const setting = new Setting(context.container).setName(fieldLabels[field]).addToggle((toggle) => toggle
			.setValue(enabled.has(field)).onChange((active) => {
				if (active) {
					enabled.add(field);
					config.displayFields.push(field);
				} else {
					enabled.delete(field);
					config.displayFields = config.displayFields.filter((candidate) => candidate !== field);
				}
				update({ displayFields: [...config.displayFields] });
			}));
		setting.settingEl.draggable = true;
		setting.settingEl.addEventListener('dragstart', () => (dragged = field));
		setting.settingEl.addEventListener('dragover', (event) => event.preventDefault());
		setting.settingEl.addEventListener('drop', () => {
			if (!dragged || dragged === field || !enabled.has(dragged) || !enabled.has(field)) return;
			const fields = config.displayFields.filter((candidate) => candidate !== dragged);
			fields.splice(fields.indexOf(field), 0, dragged);
			update({ displayFields: fields });
		});
	}
}

export function renderRecentFilesSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as RecentFilesDashboardModuleConfig;
	const update = (patch: Partial<RecentFilesDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '文件', '按创建、编辑或从本次升级后累计的打开次数排序。');
	new Setting(context.container).setName('显示模式').addDropdown((dropdown) => dropdown
		.addOption('recent-files', '最近文件')
		.addOption('recent-edited', '最近编辑')
		.addOption('recent-created', '最近创建')
		.addOption('frequently-opened', '常用文件')
		.setValue(config.mode)
		.onChange((mode) => update({ mode: mode as RecentFilesDashboardModuleConfig['mode'] })));
	new Setting(context.container).setName('根目录').addText((text) => text
		.setPlaceholder('留空表示整个库')
		.setValue(config.rootPath)
		.onChange((rootPath) => update({ rootPath })));
	new Setting(context.container).setName('排除目录').setDesc('每行一个相对库根目录的路径，并排除其全部子目录。').addTextArea((area) => area
		.setPlaceholder('模板\n归档')
		.setValue(config.excludePaths.join('\n'))
		.onChange((value) => update({ excludePaths: value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) })));
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

export function renderTextSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as TextDashboardModuleConfig;
	const update = (markdown: string) => {
		config = { ...config, markdown };
		context.update(config);
	};
	section(context.container, 'Markdown 文本', '编辑内容时在下方实时预览，支持 Obsidian Markdown。');
	const editor = context.container.createDiv({ cls: 'op-text-card-editor' });
	const textarea = editor.createEl('textarea', {
		cls: 'op-text-card-input',
		attr: { placeholder: '输入 Markdown 内容', rows: '8' },
	});
	textarea.value = config.markdown;
	const preview = editor.createDiv({ cls: 'op-text-card-preview markdown-rendered' });
	let generation = 0;
	let previewComponent = new Component();
	previewComponent.load();
	context.component.addChild(previewComponent);
	const renderPreview = async () => {
		const current = ++generation;
		previewComponent.unload();
		context.component.removeChild(previewComponent);
		previewComponent = new Component();
		previewComponent.load();
		context.component.addChild(previewComponent);
		const staging = createDiv();
		await MarkdownRenderer.render(context.manager.app, textarea.value, staging, '', previewComponent);
		if (current !== generation) return;
		preview.empty();
		preview.append(...Array.from(staging.childNodes));
	};
	textarea.addEventListener('input', () => {
		update(textarea.value);
		void renderPreview();
	});
	void renderPreview();
}

export function renderIframeSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as IframeDashboardModuleConfig;
	const update = (url: string) => {
		config = { ...config, url };
		context.update(config);
	};
	section(context.container, '网页内容', '输入需要嵌入卡片的完整 HTTP 或 HTTPS 地址。目标网站可以通过自身安全策略拒绝嵌入。');
	new Setting(context.container)
		.setName('网页地址')
		.setDesc('仅当前卡片加载该地址；插件不会读取或上传 vault 内容。')
		.addText((text) => {
			text.inputEl.type = 'url';
			text.setPlaceholder('输入 HTTPS 地址').setValue(config.url).onChange(update);
		});
}

function fallbackChartData(): ChartData {
	return { labels: ['项目 1'], series: [{ name: '数值', values: [0] }] };
}

function renderChartDataTable(
	container: HTMLElement,
	data: ChartData,
	onChange: (data: ChartData, rerender?: boolean) => void,
): void {
	const table = container.createEl('table', { cls: 'op-chart-data-table' });
	const header = table.createEl('thead').createEl('tr');
	header.createEl('th', { text: '分类' });
	for (const [seriesIndex, series] of data.series.entries()) {
		const cell = header.createEl('th');
		const input = cell.createEl('input', { attr: { type: 'text', 'aria-label': `系列 ${seriesIndex + 1} 名称` } });
		input.value = series.name;
		input.addEventListener('input', () => {
			series.name = input.value;
			onChange(data);
		});
		if (data.series.length > 1) {
			const remove = cell.createEl('button', { cls: 'op-chart-table-remove', attr: { type: 'button', 'aria-label': '删除此系列', title: '删除此系列' } });
			remove.setText('×');
			remove.addEventListener('click', () => {
				data.series.splice(seriesIndex, 1);
				onChange(data, true);
			});
		}
	}
	header.createEl('th', { text: '操作' });
	const body = table.createEl('tbody');
	for (const [rowIndex, label] of data.labels.entries()) {
		const row = body.createEl('tr');
		const labelCell = row.createEl('td');
		const labelInput = labelCell.createEl('input', { attr: { type: 'text', 'aria-label': `第 ${rowIndex + 1} 行分类` } });
		labelInput.value = label;
		labelInput.addEventListener('input', () => {
			data.labels[rowIndex] = labelInput.value;
			onChange(data);
		});
		for (const [seriesIndex, series] of data.series.entries()) {
			const valueCell = row.createEl('td');
			const valueInput = valueCell.createEl('input', { attr: { type: 'number', step: 'any', 'aria-label': `第 ${rowIndex + 1} 行系列 ${seriesIndex + 1}` } });
			valueInput.value = String(series.values[rowIndex] ?? 0);
			valueInput.addEventListener('input', () => {
				series.values[rowIndex] = Number(valueInput.value) || 0;
				onChange(data);
			});
		}
		const action = row.createEl('td');
		const remove = action.createEl('button', { cls: 'op-chart-table-remove', attr: { type: 'button', 'aria-label': '删除此行', title: '删除此行' } });
		remove.setText('×');
		remove.disabled = data.labels.length <= 1;
		remove.addEventListener('click', () => {
			data.labels.splice(rowIndex, 1);
			for (const series of data.series) series.values.splice(rowIndex, 1);
			onChange(data, true);
		});
	}
}

export function renderChartSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as ChartDashboardModuleConfig;
	const update = (patch: Partial<ChartDashboardModuleConfig>) => {
		config = { ...config, ...patch };
		context.update(config);
	};
	section(context.container, '图表数据', '第一列为分类，后续列为数据系列；饼图使用第一组数据。');
	new Setting(context.container).setName('图表类型').addDropdown((dropdown) => dropdown
		.addOption('line', '折线图')
		.addOption('bar', '柱状图')
		.addOption('pie', '饼图')
		.setValue(config.chartType)
		.onChange((chartType) => update({ chartType: chartType as ChartDashboardModuleConfig['chartType'] })));
	section(context.container, '图表显示', '坐标轴仅用于折线图和柱状图；其余选项按当前图表类型显示。');
	new Setting(context.container).setName('显示坐标轴').addToggle((toggle) => toggle.setValue(config.showAxes).onChange((showAxes) => update({ showAxes })));
	new Setting(context.container).setName('显示图例').addToggle((toggle) => toggle.setValue(config.showLegend).onChange((showLegend) => update({ showLegend })));
	new Setting(context.container).setName('显示数据标签').addToggle((toggle) => toggle.setValue(config.showDataLabels).onChange((showDataLabels) => update({ showDataLabels })));
	new Setting(context.container).setName('坐标轴颜色').addColorPicker((picker) => picker.setValue(config.axisColor).onChange((axisColor) => update({ axisColor })));
	new Setting(context.container).setName('图例颜色').addColorPicker((picker) => picker.setValue(config.legendColor).onChange((legendColor) => update({ legendColor })));
	new Setting(context.container).setName('数据标签颜色').addColorPicker((picker) => picker.setValue(config.dataLabelColor).onChange((dataLabelColor) => update({ dataLabelColor })));
	const colorSetting = new Setting(context.container).setName('数据系列颜色').setDesc('最多配置 8 个系列，未配置的系列使用默认颜色。');
	const colors = colorSetting.controlEl.createDiv({ cls: 'op-chart-series-colors' });
	for (let index = 0; index < Math.max(3, config.seriesColors.length); index += 1) {
		const picker = colors.createEl('input', { attr: { type: 'color', 'aria-label': `系列 ${index + 1} 颜色` } });
		picker.value = config.seriesColors[index] ?? ['#0c66e4', '#22a06b', '#c25100'][index % 3]!;
		picker.addEventListener('input', () => {
			const seriesColors = [...config.seriesColors];
			seriesColors[index] = picker.value;
			update({ seriesColors });
		});
	}
	const csvSetting = new Setting(context.container).setName('粘贴 CSV').setDesc('第一行为列名；数据修改后会同步到下方表格。');
	let data: ChartData;
	try {
		data = parseChartCsv(config.csv);
	} catch {
		data = fallbackChartData();
	}
	const tableHost = context.container.createDiv({ cls: 'op-chart-data-table-wrap' });
	const tableActions = context.container.createDiv({ cls: 'op-chart-table-actions' });
	const csvArea = csvSetting.controlEl.createEl('textarea', { cls: 'op-chart-csv-input', attr: { rows: '6' } });
	csvArea.value = config.csv;
	const syncData = () => {
		const csv = serializeChartData(data);
		csvArea.value = csv;
		update({ csv });
	};
	const renderTable = () => {
		tableHost.empty();
		renderChartDataTable(tableHost, data, (_next, rerender) => {
			syncData();
			if (rerender) renderTable();
		});
	};
	const addRow = tableActions.createEl('button', { text: '新增数据行', attr: { type: 'button' } });
	addRow.addEventListener('click', () => {
		data.labels.push(`项目 ${data.labels.length + 1}`);
		for (const series of data.series) series.values.push(0);
		syncData();
		renderTable();
	});
	const addSeries = tableActions.createEl('button', { text: '新增数据系列', attr: { type: 'button' } });
	addSeries.addEventListener('click', () => {
		data.series.push({ name: `系列 ${data.series.length + 1}`, values: data.labels.map(() => 0) });
		syncData();
		renderTable();
	});
	csvArea.addEventListener('input', () => {
		update({ csv: csvArea.value });
		try {
			data = parseChartCsv(csvArea.value);
			renderTable();
		} catch {
			// Keep the last valid table while the pasted CSV is incomplete.
		}
	});
	renderTable();
}
