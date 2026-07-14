import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCustomFieldValue } from '../../src/views/custom-field-presentation';
import { calendarWeekDates } from '../../src/views/calendar-range';

const projectSource = readFileSync(new URL('../../src/views/project-view.ts', import.meta.url), 'utf8');
const taskCardSource = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('project view regressions', () => {
	it('formats custom date-time fields without seconds or timezone information', () => {
		expect(formatCustomFieldValue({ id: '1', key: 'launch', name: '上线时间', type: 'datetime', required: false, active: true, default: null }, '2026-07-13T09:45:00+08:00'))
			.toBe('2026-07-13 09:45');
		expect(formatCustomFieldValue({ id: '2', key: 'day', name: '日期', type: 'date', required: false, active: true, default: null }, '2026-07-13T09:45:00+08:00'))
			.toBe('2026-07-13');
		expect(taskCardSource).toContain('formatTaskCustomFields');
		expect(projectSource).toContain('formatCustomFieldValue');
	});

	it('provides a Monday-through-Sunday calendar week', () => {
		expect(calendarWeekDates(new Date(2026, 6, 15))).toEqual([
			'2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19',
		]);
	});

	it('adds a weekly calendar submode with week-aware navigation', () => {
		expect(projectSource).toContain("calendarMode: 'month' | 'week'");
		expect(projectSource).toContain('op-calendar-mode-switch');
		expect(projectSource).toContain("this.calendarMode === 'week'");
		expect(projectSource).toContain('calendarWeekDates');
		expect(css).toContain('.op-calendar-mode-switch');
	});

	it('keeps calendar key and title together without the generic title flex basis', () => {
		expect(projectSource).toMatch(/titleClassName: 'op-calendar-task-title'[\s\S]{0,220}keyTitleInline: true/u);
		expect(css).toMatch(/\.op-calendar-task \.op-task-field-flow\s*\{[^}]*gap:/u);
		expect(css).toMatch(/\.op-calendar-task \.op-card-field\s*\{[^}]*flex:\s*0 1 auto/u);
		expect(css).not.toMatch(/\.op-calendar-task \.op-task-field-flow > \.op-task-title\s*\{[^}]*180px/u);
	});
});
