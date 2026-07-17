import type { HeatmapDashboardModuleConfig } from '../../domain/types';
import { createModuleBody } from './card-ui';
import { buildVaultHeatmap } from './heatmap-model';
import { buildCheckInHeatmap, checkInHistoryFor } from './check-in-model';
import { renderHeatmapSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

function renderHeatmap(context: DashboardModuleRenderContext): void {
	const config = context.card.moduleConfig as HeatmapDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-heatmap-card');
	const model = config.useCheckInData
		? buildCheckInHeatmap(checkInHistoryFor(context.manager.personalDashboardSettings.checkInHistories, config.checkInCardId), config.days)
		: buildVaultHeatmap(context.manager.dashboardVaultCache.allFiles(), config.rootPaths, config.excludePaths, config.days);
	const summary = body.createDiv({ cls: 'op-heatmap-summary' });
	summary.createEl('strong', { text: String(model.total) });
	summary.createSpan({ text: config.useCheckInData ? `${config.days} 天内打卡次数` : `${config.days} 天内最后修改的文件` });
	const scroll = body.createDiv({ cls: 'op-heatmap-scroll' });
	const grid = scroll.createDiv({ cls: 'op-heatmap-grid' });
	grid.style.setProperty('--op-heatmap-color', config.color);
	grid.style.gridTemplateColumns = `repeat(${model.cells.length / 7}, 11px)`;
	for (const cell of model.cells) {
		grid.createSpan({
			cls: `op-heatmap-cell is-level-${cell.level}`,
			attr: {
				title: `${cell.date}：${cell.count} ${config.useCheckInData ? '次打卡' : '个文件'}`,
				'aria-label': `${cell.date}：${cell.count} ${config.useCheckInData ? '次打卡' : '个文件'}`,
				style: `--op-heatmap-level: ${cell.level / 4}`,
			},
		});
	}
	body.createDiv({ cls: 'op-heatmap-note', text: config.useCheckInData ? '按个人仪表盘打卡记录统计。' : '按每个文件当前的最后修改日期统计，不代表历史编辑次数。' });
}

export const heatmapDefinition: DashboardModuleDefinition = {
	kind: 'heatmap', label: '热力图', icon: 'layout-grid', render: renderHeatmap, renderSettings: renderHeatmapSettings,
};
