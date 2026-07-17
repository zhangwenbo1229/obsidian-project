import type { TimeProgressDashboardModuleConfig } from '../../domain/types';
import { createModuleBody } from './card-ui';
import { renderTimeProgressSettings } from './module-settings';
import { periodProgress } from './time-progress-model';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

function renderTimeProgress(context: DashboardModuleRenderContext): void {
	const config = context.card.moduleConfig as TimeProgressDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-time-progress-card');
	body.style.setProperty('--op-time-progress-fill', config.fillColor);
	body.style.setProperty('--op-time-progress-track', config.trackColor);
	const snapshot = periodProgress(new Date());
	const items = [
		{ ...snapshot.week, visible: config.showWeek },
		{ ...snapshot.month, visible: config.showMonth },
		{ ...snapshot.year, visible: config.showYear },
	].filter((item) => item.visible);
	for (const item of items) {
		const row = body.createDiv({ cls: 'op-time-progress-row' });
		const track = row.createDiv({ cls: 'op-time-progress-track' });
		track.createSpan({ attr: { style: `--op-time-progress: ${item.value}` } });
		row.createSpan({ cls: 'op-time-progress-label', text: `${item.label}：${(item.value * 100).toFixed(1)}%` });
	}
}

export const timeProgressDefinition: DashboardModuleDefinition = {
	kind: 'progress',
	label: '进度',
	icon: 'chart-no-axes-gantt',
	render: renderTimeProgress,
	renderSettings: renderTimeProgressSettings,
};
