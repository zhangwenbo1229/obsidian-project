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
	new Setting(context.container).setName('接口密钥').setDesc('和风天气或开放天气地图使用；密钥保存在插件配置中。').addText((text) => {
		text.inputEl.type = 'password';
		text.setPlaceholder('免密钥数据源可留空')
			.setValue(config.apiKey)
			.onChange((apiKey) => update({ apiKey }));
	});
	new Setting(context.container).setName('接口主机').setDesc('仅和风天气使用，填写控制台分配的接口主机。').addText((text) => text
		.setPlaceholder('https://abc.re.qweatherapi.com')
		.setValue(config.apiHost)
		.onChange((apiHost) => update({ apiHost })));
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
	new Setting(context.container).setName('排除目录').setDesc('每行一个相对库根目录的路径，并排除其全部子目录。').addTextArea((area) => area
		.setPlaceholder('模板\n归档')
		.setValue(config.excludePaths.join('\n'))
		.onChange((value) => update({ excludePaths: value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) })));
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
