import { Component, MarkdownRenderer, Setting } from 'obsidian';
import type { ChartDashboardModuleConfig, IframeDashboardModuleConfig, TextDashboardModuleConfig } from '../../domain/types';
import { parseChartCsv, serializeChartData, type ChartData } from './chart-model';
import type { DashboardModuleSettingsContext } from './types';

function section(container: HTMLElement, title: string, description: string): void {
	const header = container.createDiv({ cls: 'op-dashboard-module-settings-header' });
	header.createEl('h3', { text: title });
	header.createEl('p', { text: description });
}

export function renderTextSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as TextDashboardModuleConfig;
	const update = (markdown: string) => { config = { ...config, markdown }; context.update(config); };
	section(context.container, 'Markdown 文本', '编辑内容时在下方实时预览，支持 Obsidian Markdown。');
	const editor = context.container.createDiv({ cls: 'op-text-card-editor' });
	const textarea = editor.createEl('textarea', { cls: 'op-text-card-input', attr: { placeholder: '输入 Markdown 内容', rows: '8' } });
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
	textarea.addEventListener('input', () => { update(textarea.value); void renderPreview(); });
	void renderPreview();
}

export function renderIframeSettings(context: DashboardModuleSettingsContext): void {
	let config = context.config as IframeDashboardModuleConfig;
	const update = (url: string) => { config = { ...config, url }; context.update(config); };
	section(context.container, '网页内容', '输入需要嵌入卡片的完整 HTTP 或 HTTPS 地址。目标网站可以通过自身安全策略拒绝嵌入。');
	new Setting(context.container).setName('网页地址').setDesc('仅当前卡片加载该地址；插件不会读取或上传 vault 内容。').addText((text) => {
		text.inputEl.type = 'url';
		text.setPlaceholder('输入 HTTPS 地址').setValue(config.url).onChange(update);
	});
}

function fallbackChartData(): ChartData {
	return { labels: ['项目 1'], series: [{ name: '数值', values: [0] }] };
}

function renderChartDataTable(container: HTMLElement, data: ChartData, onChange: (data: ChartData, rerender?: boolean) => void): void {
	const table = container.createEl('table', { cls: 'op-chart-data-table' });
	const header = table.createEl('thead').createEl('tr');
	header.createEl('th', { text: '分类' });
	for (const [seriesIndex, series] of data.series.entries()) {
		const cell = header.createEl('th');
		const input = cell.createEl('input', { attr: { type: 'text', 'aria-label': `系列 ${seriesIndex + 1} 名称` } });
		input.value = series.name;
		input.addEventListener('input', () => { series.name = input.value; onChange(data); });
		if (data.series.length > 1) {
			const remove = cell.createEl('button', { cls: 'op-chart-table-remove', attr: { type: 'button', 'aria-label': '删除此系列', title: '删除此系列' } });
			remove.setText('×');
			remove.addEventListener('click', () => { data.series.splice(seriesIndex, 1); onChange(data, true); });
		}
	}
	header.createEl('th', { text: '操作' });
	const body = table.createEl('tbody');
	for (const [rowIndex, label] of data.labels.entries()) {
		const row = body.createEl('tr');
		const labelInput = row.createEl('td').createEl('input', { attr: { type: 'text', 'aria-label': `第 ${rowIndex + 1} 行分类` } });
		labelInput.value = label;
		labelInput.addEventListener('input', () => { data.labels[rowIndex] = labelInput.value; onChange(data); });
		for (const [seriesIndex, series] of data.series.entries()) {
			const valueInput = row.createEl('td').createEl('input', { attr: { type: 'number', step: 'any', 'aria-label': `第 ${rowIndex + 1} 行系列 ${seriesIndex + 1}` } });
			valueInput.value = String(series.values[rowIndex] ?? 0);
			valueInput.addEventListener('input', () => { series.values[rowIndex] = Number(valueInput.value) || 0; onChange(data); });
		}
		const remove = row.createEl('td').createEl('button', { cls: 'op-chart-table-remove', attr: { type: 'button', 'aria-label': '删除此行', title: '删除此行' } });
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
	const update = (patch: Partial<ChartDashboardModuleConfig>) => { config = { ...config, ...patch }; context.update(config); };
	section(context.container, '图表数据', '第一列为分类，后续列为数据系列；饼图使用第一组数据。');
	new Setting(context.container).setName('图表类型').addDropdown((dropdown) => dropdown
		.addOption('line', '折线图').addOption('bar', '柱状图').addOption('pie', '饼图').setValue(config.chartType)
		.onChange((chartType) => update({ chartType: chartType as ChartDashboardModuleConfig['chartType'] })));
	section(context.container, '图表显示', '坐标轴仅用于折线图和柱状图；其余选项按当前图表类型显示。');
	new Setting(context.container).setName('显示坐标轴').addToggle((toggle) => toggle.setValue(config.showAxes).onChange((showAxes) => update({ showAxes })));
	new Setting(context.container).setName('显示图例').addToggle((toggle) => toggle.setValue(config.showLegend).onChange((showLegend) => update({ showLegend })));
	new Setting(context.container).setName('显示数据标签').addToggle((toggle) => toggle.setValue(config.showDataLabels).onChange((showDataLabels) => update({ showDataLabels })));
	new Setting(context.container).setName('坐标轴颜色').addColorPicker((picker) => picker.setValue(config.axisColor).onChange((axisColor) => update({ axisColor })));
	new Setting(context.container).setName('图例颜色').addColorPicker((picker) => picker.setValue(config.legendColor).onChange((legendColor) => update({ legendColor })));
	new Setting(context.container).setName('数据标签颜色').addColorPicker((picker) => picker.setValue(config.dataLabelColor).onChange((dataLabelColor) => update({ dataLabelColor })));
	const colors = new Setting(context.container).setName('数据系列颜色').setDesc('最多配置 8 个系列，未配置的系列使用默认颜色。').controlEl.createDiv({ cls: 'op-chart-series-colors' });
	for (let index = 0; index < Math.max(3, config.seriesColors.length); index += 1) {
		const picker = colors.createEl('input', { attr: { type: 'color', 'aria-label': `系列 ${index + 1} 颜色` } });
		picker.value = config.seriesColors[index] ?? ['#0c66e4', '#22a06b', '#c25100'][index % 3]!;
		picker.addEventListener('input', () => { const seriesColors = [...config.seriesColors]; seriesColors[index] = picker.value; update({ seriesColors }); });
	}
	const csvSetting = new Setting(context.container).setName('粘贴 CSV').setDesc('第一行为列名；数据修改后会同步到下方表格。');
	let data: ChartData;
	try { data = parseChartCsv(config.csv); } catch { data = fallbackChartData(); }
	const tableHost = context.container.createDiv({ cls: 'op-chart-data-table-wrap' });
	const tableActions = context.container.createDiv({ cls: 'op-chart-table-actions' });
	const csvArea = csvSetting.controlEl.createEl('textarea', { cls: 'op-chart-csv-input', attr: { rows: '6' } });
	csvArea.value = config.csv;
	const syncData = () => { const csv = serializeChartData(data); csvArea.value = csv; update({ csv }); };
	const renderTable = () => { tableHost.empty(); renderChartDataTable(tableHost, data, (_next, rerender) => { syncData(); if (rerender) renderTable(); }); };
	tableActions.createEl('button', { text: '新增数据行', attr: { type: 'button' } }).addEventListener('click', () => {
		data.labels.push(`项目 ${data.labels.length + 1}`); for (const series of data.series) series.values.push(0); syncData(); renderTable();
	});
	tableActions.createEl('button', { text: '新增数据系列', attr: { type: 'button' } }).addEventListener('click', () => {
		data.series.push({ name: `系列 ${data.series.length + 1}`, values: data.labels.map(() => 0) }); syncData(); renderTable();
	});
	csvArea.addEventListener('input', () => { update({ csv: csvArea.value }); try { data = parseChartCsv(csvArea.value); renderTable(); } catch { /* Keep last valid table. */ } });
	renderTable();
}
