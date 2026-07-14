import { describe, expect, it } from 'vitest';
import * as dashboardLayout from '../../src/views/dashboard-layout';

const {
	bindDashboardFilter,
	defaultDashboardCardBackground,
	normalizeDashboardLayout,
	reorderDashboardCards,
	resizeDashboardCard,
	updateDashboardCardPresentation,
} = dashboardLayout;

describe('personal dashboard layout', () => {
	it('normalizes, reorders, resizes, and binds cards', () => {
		const layout = normalizeDashboardLayout([]);
		expect(layout.map((card) => card.id)).toEqual([
			'completed', 'incomplete', 'terminated', 'overdue-stat', 'completion-rate', 'overdue-list', 'pending-list',
		]);
		const reordered = reorderDashboardCards(layout, 'pending-list', 'completed');
		expect(reordered[0]?.id).toBe('pending-list');
		const resized = resizeDashboardCard(reordered, 'pending-list', 9, 0);
		expect(resized[0]).toMatchObject({ columnSpan: 4, rowSpan: 1 });
		const bound = bindDashboardFilter(resized, 'pending-list', 'filter-1');
		expect(bound[0]?.filterId).toBe('filter-1');
	const updatePresentation = (dashboardLayout as Record<string, unknown>).updateDashboardCardPresentation as undefined | ((
			layout: ReturnType<typeof normalizeDashboardLayout>,
			cardId: 'pending-list',
			presentation: { title: string; numberColor: string },
		) => ReturnType<typeof normalizeDashboardLayout>);
		expect(typeof updatePresentation).toBe('function');
		if (typeof updatePresentation !== 'function') return;
		const customized = updatePresentation(bound, 'pending-list', {
			title: '本周重点',
			numberColor: '#d14343',
		});
		expect(customized[0]).toMatchObject({ title: '本周重点', numberColor: '#d14343' });
		expect(normalizeDashboardLayout(customized)[0]).toMatchObject({ title: '本周重点', numberColor: '#d14343' });
	});

	it('provides semantic default backgrounds for every card kind', () => {
		expect(defaultDashboardCardBackground('completed')).toBe('#22a06b');
		expect(defaultDashboardCardBackground('overdue')).toBe('#c9372c');
		const layout = normalizeDashboardLayout([]);
		expect(layout.find((card) => card.id === 'completed')?.backgroundColor).toBe('#22a06b');
		expect(layout.find((card) => card.id === 'completion-rate')?.backgroundColor).toBe('#0c66e4');
		expect(layout.find((card) => card.id === 'pending-list')?.backgroundColor).toBe('#0c66e4');
		const customized = updateDashboardCardPresentation(layout, 'completed', {
			title: '今日完成', numberColor: '#164b35', backgroundColor: '#8ee2bd',
		});
		expect(customized.find((card) => card.id === 'completed')).toMatchObject({
			numberColor: '#164b35', backgroundColor: '#8ee2bd',
		});
	});

	it('preserves independently configured backgrounds for task and module cards', () => {
		const normalized = normalizeDashboardLayout([
			{
				id: 'custom-list', order: 7, columnSpan: 2, rowSpan: 2, filterId: null,
				kind: 'task-list', metric: 'total', displayFields: ['title'], backgroundColor: '#123456',
			},
			{
				id: 'custom-calendar', order: 8, columnSpan: 2, rowSpan: 3, filterId: null,
				kind: 'calendar', metric: 'total', displayFields: [], backgroundColor: '#654321',
			},
		] as never[]);
		expect(normalized.find((card) => card.id === 'custom-list')?.backgroundColor).toBe('#123456');
		expect(normalized.find((card) => card.id === 'custom-calendar')?.backgroundColor).toBe('#654321');
	});

	it('calculates a clamped grid-span preview without resizing the live card box', () => {
		const calculate = (dashboardLayout as Record<string, unknown>).calculateDashboardResizePreview as undefined | ((
			columnSpan: number,
			rowSpan: number,
			deltaX: number,
			deltaY: number,
			columnUnit: number,
			rowUnit: number,
		) => { columnSpan: number; rowSpan: number });
		expect(typeof calculate).toBe('function');
		if (!calculate) return;
		expect(calculate(2, 3, 230, 120, 220, 112)).toEqual({ columnSpan: 3, rowSpan: 4 });
		expect(calculate(1, 1, -999, 999, 220, 112)).toEqual({ columnSpan: 1, rowSpan: 6 });
	});

	it('normalizes legacy kinds and preserves user-created cards', () => {
		const custom = {
			id: 'custom-card-1', order: 7, columnSpan: 2, rowSpan: 3, filterId: 'filter-1',
			kind: 'task-list', metric: 'incomplete', displayFields: ['key', 'title', 'status'], title: '我的列表',
		};
		const normalized = normalizeDashboardLayout([custom] as never[]);
		expect(normalized.find((card) => card.id === 'completed')).toMatchObject({ kind: 'number', metric: 'completed' });
		expect(normalized.find((card) => card.id === 'completion-rate')).toMatchObject({ kind: 'percentage', metric: 'completion-rate' });
		expect(normalized.find((card) => card.id === 'pending-list')).toMatchObject({ kind: 'task-list' });
		expect(normalized.find((card) => card.id === 'pending-list')).toMatchObject({ taskListDirection: 'horizontal' });
		expect(normalized.find((card) => card.id === 'custom-card-1')).toMatchObject(custom);
		expect(normalized.find((card) => card.id === 'custom-card-1')).toMatchObject({ taskListDirection: 'horizontal' });
	});

	it('creates, updates, and deletes independently configured custom cards', () => {
		const create = (dashboardLayout as Record<string, unknown>).createDashboardCard as undefined | ((id: string, kind: string, order: number) => unknown);
		const update = (dashboardLayout as Record<string, unknown>).updateDashboardCard as undefined | ((layout: unknown[], id: string, patch: Record<string, unknown>) => unknown[]);
		const remove = (dashboardLayout as Record<string, unknown>).deleteDashboardCard as undefined | ((layout: unknown[], id: string) => unknown[]);
		expect(typeof create).toBe('function');
		expect(typeof update).toBe('function');
		expect(typeof remove).toBe('function');
		if (!create || !update || !remove) return;
		const card = create('custom-card-2', 'number', 7) as { id: string };
		const changed = update([card], card.id, { metric: 'overdue', filterId: 'filter-2', numberColor: '#ff0000' });
		expect(changed[7]).toMatchObject({ id: card.id, kind: 'number', metric: 'overdue', filterId: 'filter-2', numberColor: '#ff0000' });
		expect(remove(changed, card.id).some((item) => (item as { id?: string }).id === card.id)).toBe(false);
	});

	it('expands legacy aggregate custom fields for personal task cards', () => {
		const legacy = [{
			id: 'custom-list', order: 7, columnSpan: 2, rowSpan: 3, filterId: null,
			kind: 'task-list', metric: 'total', displayFields: ['key', 'customFields', 'title'],
		}];
		const normalized = normalizeDashboardLayout(legacy as never[], [{ key: 'review-at', name: '评审时间' }] as never[]);
		expect(normalized.find((card) => card.id === 'custom-list')?.displayFields).toEqual(['key', 'custom:review-at', 'title']);
	});
});
