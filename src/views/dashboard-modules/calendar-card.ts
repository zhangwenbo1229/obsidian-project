import { setIcon } from 'obsidian';
import type { CalendarDashboardModuleConfig } from '../../domain/types';
import { localDate } from '../../utils/dates';
import { buildCalendarMonth, getChineseCalendarMetadata } from './calendar-model';
import { createHeadingButton, createModuleBody } from './card-ui';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { renderCalendarSettings } from './module-settings';
import { checkInHistoryFor } from './check-in-model';

const cursors = new Map<string, { year: number; month: number }>();

function currentCursor(cardId: string): { year: number; month: number } {
	const existing = cursors.get(cardId);
	if (existing) return existing;
	const today = new Date();
	return { year: today.getFullYear(), month: today.getMonth() };
}

function moveMonth(cardId: string, delta: number): void {
	const cursor = currentCursor(cardId);
	const date = new Date(cursor.year, cursor.month + delta, 1);
	cursors.set(cardId, { year: date.getFullYear(), month: date.getMonth() });
}

function renderMonth(body: HTMLElement, subtitle: HTMLElement, context: DashboardModuleRenderContext): void {
	body.empty();
	const config = context.card.moduleConfig as CalendarDashboardModuleConfig;
	const cursor = currentCursor(context.card.id);
	const model = buildCalendarMonth(
		cursor.year,
		cursor.month,
		localDate(),
		config.weekStartsOn,
		config.showLunar,
		config.showHolidays,
	);
	const monthMetadata = getChineseCalendarMetadata(new Date(model.year, model.month, 15));
	subtitle.setText(`${model.year} 年 ${model.month + 1} 月 · ${monthMetadata.ganzhiYear}`);
	const grid = body.createDiv({ cls: 'op-module-calendar-grid' });
	grid.style.setProperty('--op-calendar-check-in-color', config.checkInColor);
	const checkInHistory = checkInHistoryFor(context.manager.personalDashboardSettings.checkInHistories, config.checkInCardId);
	for (const weekday of model.weekdays) grid.createDiv({ cls: 'op-module-calendar-weekday', text: weekday });
	for (const cell of model.cells) {
		const day = grid.createDiv({
			cls: `op-module-calendar-day${cell.inCurrentMonth ? '' : ' is-outside'}${cell.isToday ? ' is-today' : ''}${cell.isWeekend ? ' is-weekend' : ''}`,
			attr: {
				title: [cell.isoDate, cell.ganzhiYear, cell.lunarLabel, ...(cell.festivals ?? [])].filter(Boolean).join(' · '),
			},
		});
		if (cell.day === null) continue;
		day.createSpan({ cls: 'op-module-calendar-day-number', text: String(cell.day) });
		const annotation = cell.annotation ?? cell.lunarLabel;
		if (annotation) day.createSpan({ cls: `op-module-calendar-annotation${cell.annotation ? ' is-holiday' : ''}`, text: annotation });
		if (config.useCheckInData) {
			const count = checkInHistory[cell.isoDate]?.length ?? 0;
			if (count > 0) {
				const marker = day.createSpan({ cls: 'op-module-calendar-check-in' });
				const icon = marker.createSpan({ cls: 'op-module-calendar-check-in-icon' });
				if (/^[a-z0-9][a-z0-9-]*$/iu.test(config.checkInIcon)) setIcon(icon, config.checkInIcon);
				else icon.setText(config.checkInIcon);
				marker.createSpan({ text: String(count) });
			}
		}
	}
}

function renderCalendar(context: DashboardModuleRenderContext): void {
	const body = createModuleBody(context.container, 'op-calendar-card');
	const subtitle = context.heading.createSpan({ cls: 'op-dashboard-module-subtitle' });
	const rerender = () => renderMonth(body, subtitle, context);
	createHeadingButton(context.heading, 'chevron-left', '上个月', () => { moveMonth(context.card.id, -1); rerender(); });
	createHeadingButton(context.heading, 'calendar-clock', '回到本月', () => {
		cursors.delete(context.card.id);
		rerender();
	});
	createHeadingButton(context.heading, 'chevron-right', '下个月', () => { moveMonth(context.card.id, 1); rerender(); });
	renderMonth(body, subtitle, context);
}

export const calendarDefinition: DashboardModuleDefinition = {
	kind: 'calendar',
	label: '日历',
	icon: 'calendar-days',
	render: renderCalendar,
	renderSettings: renderCalendarSettings,
};
