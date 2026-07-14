import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('personal card workspace', () => {
	it('removes the filter sidebar and supports card layout interactions', () => {
		expect(source).not.toContain('renderSidebar');
		expect(source).toContain("addEventListener('contextmenu'");
		expect(source).toContain('draggable = true');
		expect(source).toContain('op-dashboard-resize-handle');
		expect(source).not.toContain("setIcon(handle, 'scaling')");
		expect(source).toContain("addEventListener('pointerdown'");
		expect(source).toContain('setPointerCapture');
		expect(css).toContain('.op-dashboard-card');
		expect(css).not.toContain('resize: both');
		expect(css).toContain('resize: none');
		expect(css).toMatch(/\.op-dashboard-resize-handle\s*\{[^}]*opacity:\s*0/u);
	});

	it('supports card presentation settings and responsive task content', () => {
		const modal = readFileSync(new URL('../../src/modals/dashboard-card-settings-modal.ts', import.meta.url), 'utf8');
		expect(source).toContain('DashboardCardSettingsModal');
		expect(source).toContain('card.title');
		expect(source).toContain('card.numberColor');
		expect(source).toContain('card.backgroundColor');
		expect(source).toContain('--op-dashboard-card-background');
		expect(source).toContain('op-dashboard-stat-card');
		expect(modal).toContain('背景颜色');
		expect(modal).toContain('renderBackgroundSetting');
		expect(css).toContain('--op-dashboard-card-background');
		expect(source).not.toContain('op-dashboard-stat-caption');
		expect(css).toContain('scrollbar-width: none');
		expect(css).toContain('.op-dashboard-card::-webkit-scrollbar');
		expect(css).toContain('container-type: inline-size');
		expect(css).toMatch(/\.op-dashboard-card \.op-task-card-list[^{]*\{[^}]*repeat\(auto-fit/u);
		expect(css).toContain('@container');
		expect(css).toMatch(/\.op-dashboard-stat-card\s*\{[^}]*background:\s*color-mix/u);
		expect(css).toMatch(/@container\s*\(max-width:\s*260px\)/u);
		expect(css).toContain(".op-dashboard-card[data-row-span='1'] .op-dashboard-stat-value");
	});

	it('creates and configures custom cards per workspace and per card', () => {
		expect(source).toContain('openWorkspaceMenu');
		expect(source).toContain("'number'");
		expect(source).toContain("'percentage'");
		expect(source).toContain("'task-list'");
		expect(source).toContain('createDashboardCard');
		expect(source).toContain('deleteDashboardCard');
		expect(source).toContain('card.displayFields');
		expect(source).toContain('card.metric');
	});

	it('supports draggable per-card task display field ordering', () => {
		const modal = readFileSync(new URL('../../src/modals/dashboard-card-settings-modal.ts', import.meta.url), 'utf8');
		const sortable = readFileSync(new URL('../../src/settings/sortable-display-fields.ts', import.meta.url), 'utf8');
		expect(modal).toContain('SortableDisplayFields');
		expect(modal).toContain('displayFields');
		expect(sortable).toContain('draggable');
	});

	it('lets each task-list card choose horizontal or vertical task layout', () => {
		const modal = readFileSync(new URL('../../src/modals/dashboard-card-settings-modal.ts', import.meta.url), 'utf8');
		expect(modal).toContain('taskListDirection');
		expect(modal).toContain('排列方向');
		expect(source).toContain("is-${card.taskListDirection}");
		expect(css).toMatch(/\.op-task-card-list\.is-vertical\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
		expect(css).toMatch(/\.op-task-card-list\.is-horizontal\s*\{[^}]*repeat\(auto-fit/u);
	});

	it('renders manual percentage cards as progress and lets every card be copied', () => {
		const modal = readFileSync(new URL('../../src/modals/dashboard-card-settings-modal.ts', import.meta.url), 'utf8');
		expect(modal).toContain('percentageDataMode');
		expect(modal).toContain('手工输入');
		expect(source).toContain('op-dashboard-progress');
		expect(source).toContain('clampedPercentage');
		expect(source).toContain('progressValue.style.color');
		expect(source).toContain("setTitle('复制卡片')");
		expect(source).toContain('duplicateDashboardCard');
		expect(css).toContain('.op-dashboard-progress-track');
	});
});
