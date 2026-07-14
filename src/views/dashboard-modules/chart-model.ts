export interface ChartSeries {
	name: string;
	values: number[];
}

export interface ChartData {
	labels: string[];
	series: ChartSeries[];
}

function parseCsvRows(csv: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let index = 0; index < csv.length; index += 1) {
		const character = csv[index]!;
		if (character === '"') {
			if (quoted && csv[index + 1] === '"') {
				field += '"';
				index += 1;
			} else quoted = !quoted;
		} else if (character === ',' && !quoted) {
			row.push(field.trim());
			field = '';
		} else if ((character === '\n' || character === '\r') && !quoted) {
			if (character === '\r' && csv[index + 1] === '\n') index += 1;
			row.push(field.trim());
			field = '';
			if (row.some(Boolean)) rows.push(row);
			row = [];
		} else field += character;
	}
	if (quoted) throw new Error('CSV 引号未闭合。');
	row.push(field.trim());
	if (row.some(Boolean)) rows.push(row);
	return rows;
}

export function parseChartCsv(csv: string): ChartData {
	const rows = parseCsvRows(csv);
	if (rows.length < 2 || (rows[0]?.length ?? 0) < 2) throw new Error('图表至少需要标题行和一行数据。');
	const headers = rows[0]!;
	const labels: string[] = [];
	const series = headers.slice(1).map((name, index) => ({ name: name || `系列 ${index + 1}`, values: [] as number[] }));
	for (const [rowIndex, row] of rows.slice(1).entries()) {
		if (row.length !== headers.length) throw new Error(`第 ${rowIndex + 2} 行列数与标题不一致。`);
		labels.push(row[0] || `项目 ${rowIndex + 1}`);
		for (let index = 1; index < row.length; index += 1) {
			const value = Number(row[index]);
			if (!Number.isFinite(value)) throw new Error(`第 ${rowIndex + 2} 行包含非数字数据。`);
			series[index - 1]!.values.push(value);
		}
	}
	return { labels, series };
}

function quoteCsv(value: string): string {
	return /[",\r\n]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

export function serializeChartData(data: ChartData): string {
	const rows = [
		['分类', ...data.series.map((series) => series.name)],
		...data.labels.map((label, rowIndex) => [label, ...data.series.map((series) => String(series.values[rowIndex] ?? 0))]),
	];
	return rows.map((row) => row.map(quoteCsv).join(',')).join('\n');
}

function chartScale(data: ChartData, height: number) {
	const values = data.series.flatMap((series) => series.values);
	const minimum = Math.min(0, ...values);
	const maximum = Math.max(0, ...values);
	const range = maximum - minimum || 1;
	return {
		minimum,
		maximum,
		y: (value: number) => 20 + ((maximum - value) / range) * (height - 50),
	};
}

export function buildLineChart(data: ChartData, width: number, height: number) {
	const scale = chartScale(data, height);
	const plotWidth = width - 60;
	return {
		...scale,
		series: data.series.map((series) => ({
			name: series.name,
			points: series.values.map((value, index) => ({
				x: data.labels.length === 1 ? 40 + plotWidth / 2 : 40 + (index / (data.labels.length - 1)) * plotWidth,
				y: scale.y(value),
			})),
		})),
	};
}

export function buildBarChart(data: ChartData, width: number, height: number) {
	const scale = chartScale(data, height);
	const plotWidth = width - 60;
	const groupWidth = plotWidth / Math.max(1, data.labels.length);
	const barWidth = Math.max(2, groupWidth * 0.72 / Math.max(1, data.series.length));
	const baseline = scale.y(0);
	return {
		...scale,
		bars: data.labels.flatMap((_, labelIndex) => data.series.map((series, seriesIndex) => {
			const value = series.values[labelIndex] ?? 0;
			const valueY = scale.y(value);
			return {
				labelIndex,
				seriesIndex,
				value,
				x: 40 + labelIndex * groupWidth + groupWidth * 0.14 + seriesIndex * barWidth,
				y: Math.min(valueY, baseline),
				width: barWidth,
				height: Math.abs(baseline - valueY),
			};
		})),
	};
}

export function buildPieChart(data: ChartData, centerX: number, centerY: number, radius: number) {
	const series = data.series[0];
	const values = (series?.values ?? []).map((value, index) => ({ value, index })).filter((item) => item.value > 0);
	const total = values.reduce((sum, item) => sum + item.value, 0);
	let angle = -Math.PI / 2;
	return {
		slices: values.map((item) => {
			const startAngle = angle;
			const portion = item.value / total;
			angle += portion * Math.PI * 2;
			const endAngle = angle;
			const start = { x: centerX + Math.cos(startAngle) * radius, y: centerY + Math.sin(startAngle) * radius };
			const end = { x: centerX + Math.cos(endAngle) * radius, y: centerY + Math.sin(endAngle) * radius };
			const path = portion >= 0.999999
				? `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius} Z`
				: `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${portion > 0.5 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
			return {
				label: data.labels[item.index] ?? '',
				value: item.value,
				percentage: Math.round(portion * 100),
				path,
			};
		}),
	};
}
