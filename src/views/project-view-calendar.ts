import { Component, Notice } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { IndexedTask } from '../index/task-index';
import { calendarItems, filterProjectTasks } from './selectors';
import type { TaskDisplayField } from '../domain/types';
import { calendarMonthCells, calendarRangeTitle, calendarWeekDates, moveCalendarCursor } from './calendar-range';
import { renderTaskCardFields } from './task-card-fields';
import { bindTaskCardActivation } from './task-card-interaction';
import { EditTaskModal } from '../modals/edit-task-modal';
import { layoutCalendarSpans, type CalendarSpanLayout } from './calendar-span-layout';

export interface CalendarViewState {
	cursor: Date;
	mode: 'month' | 'week';
}

export function renderCalendarView(
	parent: HTMLElement,
	tasks: ReturnType<typeof filterProjectTasks>,
	manager: ProjectManager,
	state: CalendarViewState,
	fields: readonly TaskDisplayField[],
	component: Component,
	onRerender: () => void,
): void {
	const rules = manager.projectViewDisplay.behavior.calendar;
	const controls = parent.createDiv({ cls: 'op-calendar-controls' });
	const changePeriod = (delta: number) => {
		state.cursor = moveCalendarCursor(state.cursor, state.mode, delta);
		onRerender();
	};
	const previousLabel = state.mode === 'week' ? '上一周' : '上个月';
	const nextLabel = state.mode === 'week' ? '下一周' : '下个月';
	const previous = controls.createEl('button', { text: previousLabel });
	previous.addEventListener('click', () => changePeriod(-1));
	controls.createEl('strong', { text: calendarRangeTitle(state.cursor, state.mode) });
	const next = controls.createEl('button', { text: nextLabel });
	next.addEventListener('click', () => changePeriod(1));
	const modeSwitch = controls.createDiv({ cls: 'op-calendar-mode-switch' });
	for (const [mode, label] of [['month', '月'], ['week', '周']] as const) {
		const button = modeSwitch.createEl('button', { text: label, attr: { type: 'button' } });
		button.toggleClass('is-active', state.mode === mode);
		button.addEventListener('click', () => { state.mode = mode; onRerender(); });
	}
	const grid = parent.createDiv({ cls: `op-calendar-grid is-${state.mode}` });
	for (const weekday of ['一', '二', '三', '四', '五', '六', '日']) grid.createDiv({ cls: 'op-calendar-weekday', text: weekday });
	const items = calendarItems(tasks, rules.dateSource);
	const dates = state.mode === 'week' ? calendarWeekDates(state.cursor) : calendarMonthCells(state.cursor);
	const spans = layoutCalendarSpans(items, dates);
	for (let row = 0; row < Math.ceil(dates.length / 7); row += 1) {
		renderCalendarWeekRow(grid, state.mode, dates.slice(row * 7, row * 7 + 7), spans.filter((span) => span.row === row), fields, manager, rules, component, onRerender);
	}
}

function renderCalendarWeekRow(
	grid: HTMLElement,
	mode: 'month' | 'week',
	dates: readonly (string | null)[],
	spans: readonly CalendarSpanLayout[],
	fields: readonly TaskDisplayField[],
	manager: ProjectManager,
	rules: typeof manager.projectViewDisplay.behavior.calendar,
	component: Component,
	onRerender: () => void,
): void {
	const week = grid.createDiv({ cls: 'op-calendar-week-row' });
	week.style.setProperty('--op-calendar-lanes', String(Math.max(1, ...spans.map((span) => span.lane + 1))));
	const days = week.createDiv({ cls: 'op-calendar-day-layer' });
	for (const date of dates) {
		const cell = days.createDiv({ cls: `op-calendar-day${date ? '' : ' is-empty'}` });
		if (!date) continue;
		cell.dataset.date = date;
		if (rules.autoUpdateDateOnDrop) {
			cell.addEventListener('dragover', (event) => event.preventDefault());
			cell.addEventListener('drop', (event) => {
				event.preventDefault();
				const uid = event.dataTransfer?.getData('text/plain');
				const task = uid ? manager.index.get(uid) : undefined;
				if (task) void moveCalendarCard(task, date, rules.dateSource, manager, onRerender);
			});
		}
		cell.createEl('strong', { text: mode === 'week' ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : String(Number(date.slice(8, 10))) });
	}
	const layer = week.createDiv({ cls: 'op-calendar-span-layer' });
	for (const span of spans) {
		const task = manager.index.get(span.item.uid);
		if (!task) continue;
		const button = layer.createDiv({ cls: 'op-calendar-task', attr: { role: 'button', tabindex: '0', 'aria-label': task.document.metadata.title } });
		button.style.gridColumn = `${span.columnStart} / span ${span.columnSpan}`;
		button.style.gridRow = String(span.lane + 1);
		button.draggable = rules.autoUpdateDateOnDrop;
		if (button.draggable) button.addEventListener('dragstart', (event) => event.dataTransfer?.setData('text/plain', task.document.metadata.uid));
		renderTaskCardFields(button, task, manager, fields, {
			titleClassName: 'op-calendar-task-title', compact: true, component, markerBeforeKey: true, priorityInCorner: true,
			keyTitleInline: true,
		});
		bindTaskCardActivation(button, () => new EditTaskModal(manager, task).open());
	}
}

async function moveCalendarCard(
	task: IndexedTask,
	targetDate: string,
	dateSource: string,
	manager: ProjectManager,
	onRerender: () => void,
): Promise<void> {
	const document = structuredClone(task.document);
	const metadata = document.metadata;
	const shift = (value: string | null | undefined, from: string): string | null => {
		if (!value) return null;
		const days = Math.round((Date.parse(`${value.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
		const next = new Date(`${targetDate}T00:00:00Z`);
		next.setUTCDate(next.getUTCDate() + days);
		return next.toISOString().slice(0, 10);
	};
	if (dateSource === 'planned-range') {
		const from = (metadata.scheduledDate ?? metadata.dueDate)?.slice(0, 10) ?? targetDate;
		metadata.scheduledDate = targetDate;
		if (metadata.dueDate) metadata.dueDate = shift(metadata.dueDate, from);
	} else if (dateSource === 'execution-range') {
		const from = (metadata.startDate ?? metadata.endDate)?.slice(0, 10) ?? targetDate;
		metadata.startDate = targetDate;
		if (metadata.endDate) metadata.endDate = shift(metadata.endDate, from);
	} else (metadata as unknown as Record<string, unknown>)[dateSource] = targetDate;
	try { await manager.saveTask(task, document); }
	catch (error) { new Notice(error instanceof Error ? error.message : String(error)); onRerender(); }
}