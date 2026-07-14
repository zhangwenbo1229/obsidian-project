import type { CalendarDashboardModuleConfig } from '../../domain/types';
import { localDate } from '../../utils/dates';
import { buildCalendarMonth } from './calendar-model';
import { createHeadingButton, createModuleBody } from './card-ui';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { renderCalendarSettings } from './module-settings';

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
	const model = buildCalendarMonth(cursor.year, cursor.month, localDate(), config.weekStartsOn, config.showLunar);
	subtitle.setText(`${model.year} 年 ${model.month + 1} 月`);
	const grid = body.createDiv({ cls: 'op-module-calendar-grid' });
	for (const weekday of model.weekdays) grid.createDiv({ cls: 'op-module-calendar-weekday', text: weekday });
	for (const cell of model.cells) {
		const day = grid.createDiv({
			cls: `op-module-calendar-day${cell.inCurrentMonth ? '' : ' is-outside'}${cell.isToday ? ' is-today' : ''}`,
			attr: { title: cell.isoDate },
		});
		if (cell.day === null) continue;
		day.createSpan({ cls: 'op-module-calendar-day-number', text: String(cell.day) });
		const annotation = cell.holiday ?? cell.lunarLabel;
		if (annotation) day.createSpan({ cls: `op-module-calendar-annotation${cell.holiday ? ' is-holiday' : ''}`, text: annotation });
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
