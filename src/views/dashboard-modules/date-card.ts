import type { CountdownDashboardModuleConfig, DateDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { buildDateSnapshot, daysUntilDate } from './date-model';
import { renderCountdownSettings, renderDateSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

function renderDate(context: DashboardModuleRenderContext): void {
	const config = context.card.moduleConfig as DateDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-date-card');
	const update = () => {
		if (!context.isCurrent()) return;
		const snapshot = buildDateSnapshot(new Date(), config);
		body.empty();
		body.createDiv({ cls: 'op-date-day', text: snapshot.dateText });
		if (snapshot.weekday) body.createDiv({ cls: 'op-date-weekday', text: snapshot.weekday });
		if (snapshot.time) body.createDiv({ cls: 'op-date-time', text: snapshot.time });
		const metadata = [snapshot.lunar ? `农历 ${snapshot.lunar}` : '', snapshot.holiday].filter(Boolean);
		if (metadata.length > 0) body.createDiv({ cls: 'op-date-meta', text: metadata.join(' · ') });
	};
	update();
	if (config.showTime) {
		const interval = window.setInterval(() => {
			if (context.isCurrent()) update();
			else window.clearInterval(interval);
		}, config.showSeconds ? 1000 : 30_000);
		context.component.registerInterval(interval);
	}
}

function renderCountdown(context: DashboardModuleRenderContext): void {
	const config = context.card.moduleConfig as CountdownDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-countdown-card');
	const remaining = daysUntilDate(config.targetDate, new Date(), config.includeToday);
	if (remaining === null) {
		renderModuleMessage(body, 'calendar-plus', '选择目标日期', '右键打开卡片设置并填写倒计日。');
		return;
	}
	body.createDiv({ cls: 'op-countdown-event', text: config.eventName });
	const value = body.createDiv({ cls: 'op-countdown-value' });
	value.createEl('strong', { text: String(Math.abs(remaining)) });
	value.createSpan({ text: remaining > 0 ? '天' : remaining < 0 ? '天前' : '就是今天' });
	if (config.showTargetDate) body.createDiv({ cls: 'op-countdown-target', text: config.targetDate });
}

export const dateDefinition: DashboardModuleDefinition = {
	kind: 'date', label: '日期', icon: 'calendar-heart', render: renderDate, renderSettings: renderDateSettings,
};

export const countdownDefinition: DashboardModuleDefinition = {
	kind: 'countdown', label: '倒计日', icon: 'hourglass', render: renderCountdown, renderSettings: renderCountdownSettings,
};
