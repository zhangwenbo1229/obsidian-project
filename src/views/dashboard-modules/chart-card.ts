import type { ChartDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { buildBarChart, buildLineChart, buildPieChart, parseChartCsv, type ChartData } from './chart-model';
import { renderChartSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

const COLORS = ['#0c66e4', '#22a06b', '#c25100', '#6554c0', '#c9372c', '#1d7afc', '#8f7ee7', '#8590a2'];

function svgElement<K extends keyof SVGElementTagNameMap>(parent: SVGElement, tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
	const element = parent.createSvg(tag);
	for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
	return element;
}

function colorAt(config: ChartDashboardModuleConfig, index: number): string {
	return config.seriesColors[index] ?? COLORS[index % COLORS.length]!;
}

function renderLegend(container: HTMLElement, names: readonly string[], config: ChartDashboardModuleConfig): void {
	const legend = container.createDiv({ cls: 'op-chart-legend' });
	legend.style.color = config.legendColor;
	for (const [index, name] of names.entries()) {
		const item = legend.createSpan();
		item.createSpan({ cls: 'op-chart-legend-swatch', attr: { style: `--op-chart-color: ${colorAt(config, index)}` } });
		item.createSpan({ text: name });
	}
}

function renderDataLabel(svg: SVGSVGElement, x: number, y: number, value: number, config: ChartDashboardModuleConfig): void {
	const label = svgElement(svg, 'text', { x, y, 'text-anchor': 'middle', class: 'op-chart-data-label', fill: config.dataLabelColor });
	label.textContent = String(value);
}

function renderLineChart(svg: SVGSVGElement, data: ChartData, config: ChartDashboardModuleConfig): void {
	const model = buildLineChart(data, 400, 220);
	if (config.showAxes) svgElement(svg, 'line', { x1: 40, y1: 170, x2: 380, y2: 170, class: 'op-chart-axis', stroke: config.axisColor });
	for (const [seriesIndex, series] of model.series.entries()) {
		svgElement(svg, 'polyline', {
			points: series.points.map((point) => `${point.x},${point.y}`).join(' '),
			fill: 'none', stroke: colorAt(config, seriesIndex), class: 'op-chart-line',
		});
		for (const [pointIndex, point] of series.points.entries()) {
			svgElement(svg, 'circle', { cx: point.x, cy: point.y, r: 3.5, fill: colorAt(config, seriesIndex) });
			if (config.showDataLabels) renderDataLabel(svg, point.x, point.y - 8, data.series[seriesIndex]?.values[pointIndex] ?? 0, config);
		}
	}
	if (config.showAxes) renderXAxisLabels(svg, data.labels, config.axisColor);
}

function renderBarChart(svg: SVGSVGElement, data: ChartData, config: ChartDashboardModuleConfig): void {
	const model = buildBarChart(data, 400, 220);
	if (config.showAxes) svgElement(svg, 'line', { x1: 40, y1: 170, x2: 380, y2: 170, class: 'op-chart-axis', stroke: config.axisColor });
	for (const bar of model.bars) {
		svgElement(svg, 'rect', {
			x: bar.x, y: bar.y, width: bar.width, height: Math.max(1, bar.height), rx: 2,
			fill: colorAt(config, bar.seriesIndex),
		});
		if (config.showDataLabels) renderDataLabel(svg, bar.x + bar.width / 2, bar.y - 5, bar.value, config);
	}
	if (config.showAxes) renderXAxisLabels(svg, data.labels, config.axisColor);
}

function renderXAxisLabels(svg: SVGSVGElement, labels: readonly string[], color: string): void {
	const plotWidth = 340;
	for (const [index, label] of labels.entries()) {
		const x = labels.length === 1 ? 210 : 40 + (index / (labels.length - 1)) * plotWidth;
		const text = svgElement(svg, 'text', { x, y: 198, 'text-anchor': 'middle', class: 'op-chart-label', fill: color });
		text.textContent = label.length > 8 ? `${label.slice(0, 7)}…` : label;
	}
}

function renderPieChart(svg: SVGSVGElement, data: ChartData, config: ChartDashboardModuleConfig): void {
	const model = buildPieChart(data, 200, 110, 82);
	for (const [index, slice] of model.slices.entries()) {
		const path = svgElement(svg, 'path', { d: slice.path, fill: colorAt(config, index), class: 'op-chart-slice' });
		const title = svgElement(path, 'title', {});
		title.textContent = `${slice.label}: ${slice.value} (${slice.percentage}%)`;
		if (config.showDataLabels) {
			const label = svgElement(svg, 'text', { x: 200, y: 18 + index * 13, class: 'op-chart-data-label', fill: config.dataLabelColor });
			label.textContent = `${slice.label} ${slice.percentage}%`;
		}
	}
}

function renderChart(context: DashboardModuleRenderContext): void {
	const body = createModuleBody(context.container, 'op-chart-card');
	const config = context.card.moduleConfig as ChartDashboardModuleConfig;
	try {
		const data = parseChartCsv(config.csv);
		const svg = body.createSvg('svg', {
			cls: 'op-chart-svg',
			attr: {
				viewBox: '0 0 400 220', preserveAspectRatio: 'xMidYMid meet',
				role: 'img', 'aria-label': `${context.card.title ?? '图表'}：${config.chartType}`,
			},
		});
		if (config.chartType === 'line') renderLineChart(svg, data, config);
		else if (config.chartType === 'bar') renderBarChart(svg, data, config);
		else renderPieChart(svg, data, config);
		if (config.showLegend) renderLegend(body, config.chartType === 'pie' ? data.labels : data.series.map((series) => series.name), config);
	} catch (error) {
		renderModuleMessage(body, 'chart-no-axes-column', '图表数据无效', error instanceof Error ? error.message : String(error), 'op-dashboard-module-error');
	}
}

export const chartDefinition: DashboardModuleDefinition = {
	kind: 'chart',
	label: '图表',
	icon: 'chart-column',
	render: renderChart,
	renderSettings: renderChartSettings,
};
