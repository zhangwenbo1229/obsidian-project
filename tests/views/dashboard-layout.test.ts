import { describe, expect, it } from 'vitest';
import * as dashboardLayout from '../../src/views/dashboard-layout';

const {
	bindDashboardFilter,
	createDashboardCard,
	defaultDashboardCardBackground,
	normalizeDashboardLayout,
	reorderDashboardCards,
	resizeDashboardCard,
	moveDashboardCard,
	updateDashboardCardPresentation,
} = dashboardLayout;

describe('personal dashboard layout', () => {
	it('normalizes percentage progress presentation styles', () => {
		const card = createDashboardCard('percentage-custom', 'percentage', 8);
		const normalized = normalizeDashboardLayout([{ ...card, percentageDisplay: 'progress', percentageProgressStyle: 'semicircle' }]);
		expect(normalized.find((item) => item.id === 'percentage-custom')).toMatchObject({ percentageProgressStyle: 'semicircle' });
	});

	it('supports a wider card font range for compact and presentation cards', () => {
		const small = normalizeDashboardLayout([{ ...createDashboardCard('font-small', 'number', 8), fontSize: 6 }]);
		const large = normalizeDashboardLayout([{ ...createDashboardCard('font-large', 'number', 8), fontSize: 48 }]);
		expect(small.find((item) => item.id === 'font-small')?.fontSize).toBe(8);
		expect(large.find((item) => item.id === 'font-large')?.fontSize).toBe(40);
	});
	it('normalizes, reorders, resizes, and binds cards', () => {
		const layout = normalizeDashboardLayout([]);
		expect(layout.map((card) => card.id)).toEqual([
			'completed', 'incomplete', 'terminated', 'overdue-stat', 'completion-rate', 'overdue-list', 'pending-list',
		]);
		const reordered = reorderDashboardCards(layout, 'pending-list', 'completed');
		expect(reordered[0]?.id).toBe('pending-list');
		const resized = resizeDashboardCard(reordered, 'pending-list', 9, 0);
		expect(resized[0]).toMatchObject({ columnSpan: 8, rowSpan: 1 });
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

	it('normalizes manual percentage progress values and zero targets', () => {
		const normalized = normalizeDashboardLayout([{
			id: 'manual-progress', order: 7, columnSpan: 2, rowSpan: 2, filterId: null,
			kind: 'percentage', metric: 'completion-rate', displayFields: [],
			percentageDataMode: 'manual', percentageCurrent: 35, percentageTarget: 50,
			percentageDisplay: 'progress',
		}] as never[]).find((card) => card.id === 'manual-progress');
		expect(normalized).toMatchObject({
			percentageDataMode: 'manual', percentageCurrent: 35, percentageTarget: 50, percentageDisplay: 'progress',
		});
		const zero = normalizeDashboardLayout([{
			id: 'zero', kind: 'percentage', percentageTarget: 0,
		}] as never[]).find((card) => card.id === 'zero');
		expect(zero?.percentageTarget).toBe(100);
	});

	it('normalizes card font size and a direct percentage value', () => {
		const cards = normalizeDashboardLayout([{
			id: 'direct-percentage', kind: 'percentage', fontSize: 80,
			percentageDataMode: 'direct', percentageValue: 135,
		}] as never[]);
		expect(cards.find((card) => card.id === 'direct-percentage')).toMatchObject({
			fontSize: 40, percentageDataMode: 'direct', percentageValue: 100,
		});
		expect(normalizeDashboardLayout([])[0]?.fontSize).toBe(14);
	});

	it('stores an explicit collision-free position on an eight-column grid', () => {
		const layout = normalizeDashboardLayout([{
			id: 'free-card', order: 7, columnSpan: 1, rowSpan: 1, kind: 'number', metric: 'total', displayFields: [],
		}] as never[]);
		const moved = moveDashboardCard(layout, 'free-card', 8, 3);
		expect(moved.find((card) => card.id === 'free-card')).toMatchObject({ columnStart: 8, rowStart: 3 });
		const clamped = moveDashboardCard(moved, 'free-card', 99, -4);
		expect(clamped.find((card) => card.id === 'free-card')).toMatchObject({ columnStart: 8, rowStart: 1 });
		const second = normalizeDashboardLayout([...clamped, {
			id: 'second-card', order: 8, columnSpan: 1, rowSpan: 1, columnStart: 8, rowStart: 1,
			kind: 'number', metric: 'total', displayFields: [],
		}] as never[]);
		const collisionFree = moveDashboardCard(second, 'free-card', 8, 1);
		expect(collisionFree.find((card) => card.id === 'free-card')?.rowStart).toBe(2);
	});

	it('duplicates any card with deep-copied configuration after its source', () => {
		const source = normalizeDashboardLayout([{
			id: 'calendar-copy-source', order: 7, columnSpan: 2, rowSpan: 3, filterId: null,
			kind: 'calendar', metric: 'total', displayFields: [], title: '项目日历',
			moduleConfig: { showLunar: true, showHolidays: true, weekStartsOn: 1 },
		}] as never[]);
		const duplicate = (dashboardLayout as Record<string, unknown>).duplicateDashboardCard as
			| undefined
			| ((layout: typeof source, sourceId: string, newId: string) => typeof source);
		expect(typeof duplicate).toBe('function');
		if (!duplicate) return;
		const result = duplicate(source, 'calendar-copy-source', 'calendar-copy');
		const originalIndex = result.findIndex((card) => card.id === 'calendar-copy-source');
		const copied = result[originalIndex + 1];
		expect(copied).toMatchObject({ id: 'calendar-copy', title: '项目日历 副本', kind: 'calendar' });
		expect(copied?.moduleConfig).not.toBe(result[originalIndex]?.moduleConfig);
		const builtInCopy = duplicate(source, 'completion-rate', 'completion-rate-copy');
		expect(builtInCopy.find((card) => card.id === 'completion-rate-copy')?.title).toBe('完成率 副本');
	});
});
