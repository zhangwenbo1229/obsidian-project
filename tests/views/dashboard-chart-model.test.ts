import { describe, expect, it } from 'vitest';
import {
	buildBarChart,
	buildLineChart,
	buildPieChart,
	parseChartCsv,
} from '../../src/views/dashboard-modules/chart-model';

describe('dashboard chart model', () => {
	it('parses categories and multiple numeric series from CSV', () => {
		expect(parseChartCsv('月份,计划,实际\n一月,10,8\n"二,月",12,11')).toEqual({
		labels: ['一月', '二,月'],
		series: [
			{ name: '计划', values: [10, 12] },
			{ name: '实际', values: [8, 11] },
		],
	});
	});

	it('rejects malformed tables and non-numeric values', () => {
		expect(() => parseChartCsv('月份,值\n一月')).toThrow('列数');
		expect(() => parseChartCsv('月份,值\n一月,abc')).toThrow('数字');
	});

	it('creates bounded line points and grouped bars', () => {
		const data = parseChartCsv('月份,计划,实际\n一月,0,5\n二月,10,8');
		const lines = buildLineChart(data, 400, 200);
		expect(lines.series).toHaveLength(2);
		expect(lines.series[0]?.points).toEqual([{ x: 40, y: 170 }, { x: 380, y: 20 }]);
		const bars = buildBarChart(data, 400, 200);
		expect(bars.bars).toHaveLength(4);
		expect(bars.bars.every((bar) => bar.x >= 40 && bar.y >= 20 && bar.height >= 0)).toBe(true);
	});

	it('creates pie slices from the first data series and ignores non-positive values', () => {
		const pie = buildPieChart(parseChartCsv('类型,数量\n任务,3\n缺陷,1\n忽略,0'), 100, 100, 40);
		expect(pie.slices).toHaveLength(2);
		expect(pie.slices.map((slice) => slice.percentage)).toEqual([75, 25]);
		expect(pie.slices.every((slice) => slice.path.startsWith('M 100 100'))).toBe(true);
	});

	it('renders a single 100 percent value as a complete circle path', () => {
		const pie = buildPieChart(parseChartCsv('类型,数量\n任务,3'), 100, 100, 40);
		expect(pie.slices[0]?.path.match(/A 40 40/gu)).toHaveLength(2);
		expect(pie.slices[0]?.percentage).toBe(100);
	});
});
