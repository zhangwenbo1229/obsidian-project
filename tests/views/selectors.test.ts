import { describe, expect, it } from 'vitest';
import type { IndexedTask } from '../../src/index/task-index';
import { activeProjectFilterCount, ALL_PROJECTS_UID, buildTagTree, calendarItems, classifyTaskQuadrants, filterPersonalTasks, filterProjectTasks, overdueTasks, pendingTasks, taskStatistics } from '../../src/views/selectors';

function indexed(key: string, title: string, dueDate: string | null): IndexedTask {
	const project = {
		kind: 'project' as const, schema: 1 as const,
		uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PROJ', name: '项目', active: true,
		taskDirectory: '任务', groupByMonth: false, nextNumber: 1,
		taskTypes: [{ id: 'task', name: '任务', icon: 'check', color: '#000', active: true, template: null }], customFields: [],
		workflow: { initialStatusId: 'waiting', statuses: [{ id: 'waiting', name: '待处理', category: 'todo' as const, result: null, active: true }], transitions: [] },
	};
	return {
		path: `${key}.md`, project,
		document: {
			metadata: { kind: 'task', schema: 1, uid: crypto.randomUUID(), key, projectUid: project.uid, title, taskTypeId: 'task', createdAt: '2026-07-12T10:00:00+08:00', startDate: null, dueDate, completedAt: null, terminatedAt: null, reporterId: crypto.randomUUID(), assigneeId: null, statusId: 'waiting', tags: ['前端'], custom: {} },
			body: `${title}正文`, relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
		},
	};
}

describe('view selectors', () => {
	it('builds slash-separated tags into a stable hierarchy', () => {
		expect(buildTagTree(['work/backend/api', 'work/frontend', 'personal'])).toEqual([
			{ name: 'personal', path: 'personal', children: [] },
			{
				name: 'work', path: 'work', children: [
					{ name: 'backend', path: 'work/backend', children: [
						{ name: 'api', path: 'work/backend/api', children: [] },
					] },
					{ name: 'frontend', path: 'work/frontend', children: [] },
				],
			},
		]);
	});

	it('applies a persisted custom order to tag tree siblings', () => {
		expect(buildTagTree(['a', 'b', 'c'], ['c', 'a', 'b']).map((node) => node.path))
			.toEqual(['c', 'a', 'b']);
	});

	it('selecting a parent tag includes tasks using descendant tags', () => {
		const nested = indexed('PROJ-1', '接口', null);
		nested.document.metadata.tags = ['work/backend/api'];
		const unrelated = indexed('PROJ-2', '生活', null);
		unrelated.document.metadata.tags = ['personal'];
		expect(filterPersonalTasks(
			[nested, unrelated],
			{ startPeriod: 'all', tags: new Set(['work']) },
			'2026-07-12',
		)).toEqual([nested]);
	});

	it('classifies tasks into four priority and urgency quadrants', () => {
		const importantUrgent = indexed('PROJ-1', '重要紧急', '2026-07-15');
		importantUrgent.document.metadata.priority = 'high';
		const importantNotUrgent = indexed('PROJ-2', '重要不紧急', '2026-07-16');
		importantNotUrgent.document.metadata.priority = 'high';
		const notImportantUrgent = indexed('PROJ-3', '不重要紧急', '2026-07-11');
		notImportantUrgent.document.metadata.priority = 'low';
		const notImportantNotUrgent = indexed('PROJ-4', '不重要不紧急', null);
		notImportantNotUrgent.document.metadata.priority = 'medium';

		const result = classifyTaskQuadrants(
			[notImportantNotUrgent, importantNotUrgent, notImportantUrgent, importantUrgent],
			'2026-07-12',
		);
		expect(result.importantUrgent).toEqual([importantUrgent]);
		expect(result.importantNotUrgent).toEqual([importantNotUrgent]);
		expect(result.notImportantUrgent).toEqual([notImportantUrgent]);
		expect(result.notImportantNotUrgent).toEqual([notImportantNotUrgent]);
	});

	it('filters personal tasks by start date periods and excludes tasks without a start date', () => {
		const today = indexed('PROJ-1', '今天', null);
		today.document.metadata.startDate = '2026-07-12';
		const sameWeek = indexed('PROJ-2', '本周', null);
		sameWeek.document.metadata.startDate = '2026-07-06';
		const sameMonth = indexed('PROJ-3', '本月', null);
		sameMonth.document.metadata.startDate = '2026-07-31';
		const undated = indexed('PROJ-4', '未排期', null);
		const tasks = [today, sameWeek, sameMonth, undated];

		expect(filterPersonalTasks(tasks, { startPeriod: 'today', tags: new Set() }, '2026-07-12')).toEqual([today]);
		expect(filterPersonalTasks(tasks, { startPeriod: 'week', tags: new Set() }, '2026-07-12')).toEqual([today, sameWeek]);
		expect(filterPersonalTasks(tasks, { startPeriod: 'month', tags: new Set() }, '2026-07-12')).toEqual([today, sameWeek, sameMonth]);
		expect(filterPersonalTasks(tasks, { startPeriod: 'all', tags: new Set() }, '2026-07-12')).toEqual(tasks);
	});

	it('combines personal time and tag groups with AND while matching selected tags with OR', () => {
		const frontend = indexed('PROJ-1', '前端', null);
		frontend.document.metadata.startDate = '2026-07-12';
		frontend.document.metadata.tags = ['frontend'];
		const urgent = indexed('PROJ-2', '紧急', null);
		urgent.document.metadata.startDate = '2026-07-12';
		urgent.document.metadata.tags = ['urgent'];
		const outside = indexed('PROJ-3', '上个月', null);
		outside.document.metadata.startDate = '2026-06-30';
		outside.document.metadata.tags = ['frontend'];

		expect(filterPersonalTasks(
			[frontend, urgent, outside],
			{ startPeriod: 'month', tags: new Set(['frontend', 'urgent']) },
			'2026-07-12',
		)).toEqual([frontend, urgent]);
	});

	it('calculates personal statistics from the filtered task set', () => {
		const completed = indexed('PROJ-1', '已完成', '2026-07-10');
		completed.project.workflow.statuses.push({ id: 'done', name: '完成', category: 'done', result: 'completed', active: true });
		completed.document.metadata.statusId = 'done';
		const overdue = indexed('PROJ-2', '逾期', '2026-07-11');

		expect(taskStatistics([completed, overdue], '2026-07-12')).toEqual({
			completed: 1,
			terminated: 0,
			incomplete: 1,
			overdue: 1,
			completionRate: 0.5,
		});
	});

	it('counts the active filter groups shown inside the Jira-style search bar', () => {
		expect(activeProjectFilterCount({
			projectUid: 'project',
			keyword: 'login',
			statusIds: new Set(['doing']),
			tags: new Set(['frontend', 'urgent']),
			dueDateFrom: '2026-07-01',
			dueDateTo: '2026-07-31',
			customFields: { priority: new Set(['high']) },
		})).toBe(5);
	});

	it('counts and filters tasks containing incomplete Markdown subtasks', () => {
		const pending = indexed('PROJ-1', '有未完成子任务', null);
		pending.document.subtasks = '- [x] 已完成\n- [ ] 仍待处理';
		const complete = indexed('PROJ-2', '全部完成', null);
		complete.document.subtasks = '- [x] 已完成';
		const absent = indexed('PROJ-3', '没有子任务', null);

		expect(activeProjectFilterCount({
			projectUid: ALL_PROJECTS_UID,
			hasIncompleteSubtasks: true,
		})).toBe(1);
		expect(filterProjectTasks([pending, complete, absent], {
			projectUid: ALL_PROJECTS_UID,
			hasIncompleteSubtasks: true,
		})).toEqual([pending]);
	});

	it('combines different filters with AND and same values with OR', () => {
		const tasks = [indexed('PROJ-1', '登录修复', '2026-07-20'), indexed('PROJ-2', '文档', null)];
		const result = filterProjectTasks(tasks, {
			projectUid: tasks[0]!.project.uid,
			keyword: '登录',
			statusIds: new Set(['waiting', 'another']),
			tags: new Set(['前端']),
		});
		expect(result.map((item) => item.document.metadata.key)).toEqual(['PROJ-1']);
	});

	it('returns tasks from every project for the all-project scope', () => {
		const first = indexed('PROJ-1', '项目一', null);
		const second = indexed('OTHER-1', '项目二', null);
		second.project = { ...second.project, uid: '668de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'OTHER' };
		second.document.metadata.projectUid = second.project.uid;
		expect(filterProjectTasks([first, second], { projectUid: ALL_PROJECTS_UID })).toEqual([first, second]);
	});

	it('compares schedule date-times by their local calendar date', () => {
		const overdue = indexed('PROJ-1', '逾期', '2026-07-11T23:30:00+08:00');
		const today = indexed('PROJ-2', '今天', '2026-07-12T00:30:00+08:00');
		expect(overdueTasks([today, overdue], '2026-07-12').map((item) => item.document.metadata.key)).toEqual(['PROJ-1']);
		expect(calendarItems([today])).toEqual([
			{ uid: today.document.metadata.uid, key: 'PROJ-2', title: '今天', start: '2026-07-12', end: '2026-07-12' },
		]);
	});

	it('sorts pending tasks by due date with undated tasks last', () => {
		const tasks = [indexed('PROJ-1', '无日期', null), indexed('PROJ-2', '有日期', '2026-07-20')];
		expect(pendingTasks(tasks).map((item) => item.document.metadata.key)).toEqual(['PROJ-2', 'PROJ-1']);
	});

	it('returns only incomplete tasks overdue before the local day', () => {
		const overdue = indexed('PROJ-1', '逾期', '2026-07-11');
		const today = indexed('PROJ-2', '今天', '2026-07-12');
		const completed = indexed('PROJ-3', '已完成', '2026-07-10');
		completed.project.workflow.statuses.push({ id: 'done', name: '完成', category: 'done', result: 'completed', active: true });
		completed.document.metadata.statusId = 'done';
		expect(overdueTasks([today, completed, overdue], '2026-07-12').map((item) => item.document.metadata.key)).toEqual(['PROJ-1']);
	});

	it('shows only due dates and optional start ranges on the calendar', () => {
		const due = indexed('PROJ-1', '有日期', '2026-07-20');
		due.document.metadata.startDate = '2026-07-18';
		const noDue = indexed('PROJ-2', '只有开始', null);
		noDue.document.metadata.startDate = '2026-07-18';
		expect(calendarItems([due, noDue])).toEqual([
			{ uid: due.document.metadata.uid, key: 'PROJ-1', title: '有日期', start: '2026-07-18', end: '2026-07-20' },
		]);
	});

	it('keeps a task on its due date when its invalid start date is later than its due date', () => {
		const task = indexed('PROJ-1', '反向日期', '2026-07-05');
		task.document.metadata.startDate = '2026-07-13';
		expect(calendarItems([task])).toEqual([
			{ uid: task.document.metadata.uid, key: 'PROJ-1', title: '反向日期', start: '2026-07-05', end: '2026-07-05' },
		]);
	});

	it('filters date ranges and custom fields together', () => {
		const matching = indexed('PROJ-1', '匹配', '2026-07-20');
		matching.document.metadata.custom.severity = 'critical';
		const outside = indexed('PROJ-2', '超出日期', '2026-08-01');
		outside.document.metadata.custom.severity = 'critical';
		const result = filterProjectTasks([matching, outside], {
			projectUid: matching.project.uid,
			dueDateFrom: '2026-07-01',
			dueDateTo: '2026-07-31',
			customFields: { severity: new Set(['critical']) },
		});
		expect(result.map((item) => item.document.metadata.key)).toEqual(['PROJ-1']);
	});
});
