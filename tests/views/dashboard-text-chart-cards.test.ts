import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeDashboardModuleConfig } from '../../src/views/dashboard-modules/config';
import { DASHBOARD_MODULE_DEFINITIONS } from '../../src/views/dashboard-modules/registry';
import { ALL_DASHBOARD_CARD_KINDS } from '../../src/views/personal-dashboard-settings';

describe('dashboard text and chart cards', () => {
	it('registers text and chart kinds with practical defaults', () => {
		expect(DASHBOARD_MODULE_DEFINITIONS.map((item) => item.kind)).toContain('text');
		expect(DASHBOARD_MODULE_DEFINITIONS.map((item) => item.kind)).toContain('chart');
		expect(ALL_DASHBOARD_CARD_KINDS).toContain('text');
		expect(ALL_DASHBOARD_CARD_KINDS).toContain('chart');
		expect(normalizeDashboardModuleConfig('text', null)).toEqual({ markdown: '## 文本卡片\n\n在设置中输入 Markdown 内容。' });
		expect(normalizeDashboardModuleConfig('chart', null)).toMatchObject({ chartType: 'line' });
	});

	it('renders text through Obsidian Markdown and charts through local SVG', () => {
		const textCard = readFileSync(new URL('../../src/views/dashboard-modules/text-card.ts', import.meta.url), 'utf8');
		const chartCard = readFileSync(new URL('../../src/views/dashboard-modules/chart-card.ts', import.meta.url), 'utf8');
		expect(textCard).toContain('MarkdownRenderer.render');
		expect(textCard).toContain('context.component');
		expect(chartCard).toContain("createSvg('svg'");
		expect(chartCard).not.toContain('script');
	});

	it('provides editable CSV table controls and chart type selection', () => {
		const settings = readFileSync(new URL('../../src/views/dashboard-modules/module-settings.ts', import.meta.url), 'utf8');
		expect(settings).toContain('renderTextSettings');
		expect(settings).toContain('renderChartSettings');
		expect(settings).toContain('op-chart-data-table');
		expect(settings).toContain('粘贴 CSV');
		expect(settings).toContain('新增数据行');
		expect(settings).toContain('新增数据系列');
		expect(settings).toContain('删除此行');
		expect(settings).toContain('删除此系列');
		expect(settings).toContain('previewComponent.unload()');
	});
});
