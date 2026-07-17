import { describe, expect, it } from 'vitest';
import type { IndexedTask } from '../../src/index/task-index';
import {
	collectTaskViewItems,
	filterTaskViewItems,
	groupTaskViewItems,
	updateTaskViewItemCompletion,
	updateTaskViewItemTitle,
} from '../../src/views/task-view-model';

function projectDocument(key: string, subtasks: string, projectUid = 'group-a'): IndexedTask {
	const project = {
		kind: 'project' as const, schema: 1 as const, uid: projectUid, code: projectUid === 'group-a' ? 'APP' : 'OPS',
		name: projectUid === 'group-a' ? '应用分组' : '运维分组', active: true, taskDirectory: '项目', groupByMonth: false, nextNumber: 2,
		taskTypes: [{ id: 'story', name: '项目', icon: 'briefcase', color: '#0052cc', active: true, template: null }],
		customFields: [], workflow: { initialStatusId: 'todo', statuses: [{ id: 'todo', name: '待办', category: 'todo' as const, result: null, active: true }], transitions: [] },
	};
	return {
		path: `项目/${key}.md`, project,
		document: {
			metadata: { kind: 'task', schema: 1, uid: `uid-${key}`, key, projectUid, title: `${key} 项目`, taskTypeId: 'story', createdAt: '2026-07-15T09:00:00+08:00', startDate: null, dueDate: null, completedAt: null, terminatedAt: null, reporterId: 'user', assigneeId: null, statusId: 'todo', tags: [], custom: {} },
			body: '', subtasks, relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
		},
	};
}

describe('task view model', () => {
	it('collects Tasks-format and plain Markdown tasks with source references', () => {
		const parent = projectDocument('APP-1', [
			'说明文字',
			'- [ ] 发布检查 #release 🔼 ⏳ 2026-07-16 📅 2026-07-18 🆔 publish-1',
			'  - [x] 普通检查项',
		].join('\n'));

		const items = collectTaskViewItems([parent]);

		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			id: 'uid-APP-1:publish-1', kind: 'structured', title: '发布检查', completed: false,
			parentKey: 'APP-1', parentTitle: 'APP-1 项目', projectUid: 'group-a', lineNumber: 1,
			priority: 'medium', scheduledDate: '2026-07-16', dueDate: '2026-07-18', tags: ['release'],
		});
		expect(items[1]).toMatchObject({
			id: 'uid-APP-1:line:2', kind: 'markdown', title: '普通检查项', completed: true,
			lineNumber: 2, originalLine: '  - [x] 普通检查项',
		});
	});

	it('filters today, upcoming, overdue, completed and group scopes', () => {
		const app = projectDocument('APP-1', [
			'- [ ] 今天 📅 2026-07-15 🆔 today',
			'- [ ] 即将开始 ⏳ 2026-07-16 🆔 next',
			'- [ ] 已逾期 🛫 2026-07-14 🆔 late',
			'- [x] 已完成 ✅ 2026-07-15 🆔 done',
			'- [ ] 未排期 🆔 someday',
		].join('\n'));
		const ops = projectDocument('OPS-1', '- [ ] 运维任务 📅 2026-07-15 🆔 ops', 'group-b');
		const items = collectTaskViewItems([app, ops]);

		expect(filterTaskViewItems(items, { scope: 'today', today: '2026-07-15' }).map((item) => item.title)).toEqual(['今天', '运维任务']);
		expect(filterTaskViewItems(items, { scope: 'upcoming', today: '2026-07-15' }).map((item) => item.title)).toEqual(['即将开始']);
		expect(filterTaskViewItems(items, { scope: 'overdue', today: '2026-07-15' }).map((item) => item.title)).toEqual(['已逾期']);
		expect(filterTaskViewItems(items, { scope: 'completed', today: '2026-07-15' }).map((item) => item.title)).toEqual(['已完成']);
		expect(filterTaskViewItems(items, { scope: 'all', today: '2026-07-15', projectUid: 'group-b' }).map((item) => item.title)).toEqual(['运维任务']);
	});

	it('searches task and parent project text, then groups by parent project', () => {
		const first = projectDocument('APP-1', '- [ ] 修复登录 📅 2026-07-16 🆔 login');
		const second = projectDocument('APP-2', '- [ ] 更新文档 📅 2026-07-17 🆔 docs');
		const items = collectTaskViewItems([first, second]);

		expect(filterTaskViewItems(items, { scope: 'all', today: '2026-07-15', keyword: '登录' }).map((item) => item.title)).toEqual(['修复登录']);
		expect(filterTaskViewItems(items, { scope: 'all', today: '2026-07-15', keyword: 'APP-2' }).map((item) => item.title)).toEqual(['更新文档']);
		expect(groupTaskViewItems(items).map((group) => ({ key: group.parentKey, count: group.items.length }))).toEqual([
			{ key: 'APP-1', count: 1 }, { key: 'APP-2', count: 1 },
		]);
	});

	it('updates a source line without losing Tasks metadata or plain Markdown indentation', () => {
		const source = '- [ ] 发布检查 #release 📅 2026-07-18 🆔 publish-1\n  * [ ] 普通检查项';
		const items = collectTaskViewItems([projectDocument('APP-1', source)]);

		expect(updateTaskViewItemCompletion(source, items[0]!, true, '2026-07-15')).toBe(
			'- [x] 发布检查 #release 📅 2026-07-18 ✅ 2026-07-15 🆔 publish-1\n  * [ ] 普通检查项',
		);
		expect(updateTaskViewItemTitle(source, items[1]!, '新的普通检查项')).toBe(
			'- [ ] 发布检查 #release 📅 2026-07-18 🆔 publish-1\n  * [ ] 新的普通检查项',
		);
	});

	it('rejects stale line references instead of modifying a different task', () => {
		const source = '- [ ] 原任务 🆔 original';
		const item = collectTaskViewItems([projectDocument('APP-1', source)])[0]!;
		expect(() => updateTaskViewItemTitle('- [ ] 已被外部修改 🆔 original', item, '新标题'))
			.toThrow('任务内容已被修改');
	});
});
