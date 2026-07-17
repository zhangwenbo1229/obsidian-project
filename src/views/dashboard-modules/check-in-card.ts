import { Notice, setIcon } from 'obsidian';
import type { CheckInDashboardModuleConfig } from '../../domain/types';
import { localDate } from '../../utils/dates';
import { createModuleBody } from './card-ui';
import { checkInHistoryFor, checkInSummary } from './check-in-model';
import { renderCheckInSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

function renderCheckIn(context: DashboardModuleRenderContext): void {
	const config = context.card.moduleConfig as CheckInDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-check-in-card');
	const today = localDate();
	const history = checkInHistoryFor(context.manager.personalDashboardSettings.checkInHistories, context.card.id);
	const summary = checkInSummary(history, today, config.dailyTarget);
	const status = body.createDiv({ cls: `op-check-in-status${summary.completedToday ? ' is-complete' : ''}` });
	setIcon(status.createSpan({ cls: 'op-check-in-status-icon' }), summary.completedToday ? 'badge-check' : 'circle-dashed');
	const copy = status.createDiv();
	copy.createEl('strong', { text: summary.completedToday ? '今日已完成' : '今日待打卡' });
	copy.createSpan({ text: `${summary.todayCount} / ${summary.dailyTarget} 次` });
	if (config.progressStyle === 'semicircle') {
		const gauge = body.createDiv({
			cls: 'op-check-in-progress is-semicircle op-semicircle-gauge',
			attr: {
				role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(summary.dailyTarget),
				'aria-valuenow': String(summary.todayCount), style: `--op-progress: ${summary.progress}`,
			},
		});
		gauge.createSpan({ cls: 'op-semicircle-gauge-track' });
		gauge.createEl('strong', { text: `${Math.round(summary.progress * 100)}%` });
	} else {
		const progress = body.createDiv({ cls: 'op-check-in-progress is-linear', attr: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(summary.dailyTarget), 'aria-valuenow': String(summary.todayCount) } });
		progress.style.setProperty('--op-check-in-progress', String(summary.progress));
		progress.createSpan();
	}
	const metrics = body.createDiv({ cls: 'op-check-in-metrics' });
	if (config.showTotalDays) metrics.createSpan({ text: `累计 ${summary.totalDays} 天` });
	if (config.showStreak) metrics.createSpan({ text: `连续 ${summary.currentStreak} 天` });
	const button = body.createEl('button', { cls: 'mod-cta op-check-in-button', text: config.buttonLabel, attr: { type: 'button' } });
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		button.disabled = true;
		void context.manager.addDashboardCheckIn(context.card.id, today)
			.then(() => context.refresh())
			.catch((error: unknown) => {
				button.disabled = false;
				new Notice(error instanceof Error ? error.message : String(error));
			});
	});
}

export const checkInDefinition: DashboardModuleDefinition = {
	kind: 'check-in', label: '打卡', icon: 'badge-check', render: renderCheckIn, renderSettings: renderCheckInSettings,
};
