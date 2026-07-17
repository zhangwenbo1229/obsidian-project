import { describe, expect, it } from 'vitest';
import {
	parseTasksLine,
	serializeTasksLine,
	updateTasksLineCompletion,
	updateTasksLineTitle,
} from '../../src/markdown/tasks-line-parser';

describe('Tasks emoji task lines', () => {
	it('parses title separately from Tasks metadata', () => {
		const parsed = parseTasksLine('- [ ] 完成发布检查 #release 🔼 ⏳ 2026-07-18 🛫 2026-07-16 📅 2026-07-20 ➕ 2026-07-15 🆔 a1b2c3');
		expect(parsed).toMatchObject({
			marker: '-', status: ' ', completed: false, title: '完成发布检查', priority: 'medium',
			scheduledDate: '2026-07-18', startDate: '2026-07-16', dueDate: '2026-07-20',
			createdDate: '2026-07-15', id: 'a1b2c3', tags: ['release'],
		});
	});

	it('round-trips completed Tasks metadata in canonical order', () => {
		const line = serializeTasksLine({
			marker: '-', status: 'x', completed: true, title: '发布版本', priority: 'high', tags: ['release', 'urgent'],
			scheduledDate: '2026-07-18', startDate: '2026-07-16', dueDate: '2026-07-20',
			createdDate: '2026-07-15', doneDate: '2026-07-19', cancelledDate: null, id: 'release-1',
		});
		expect(line).toBe('- [x] 发布版本 #release #urgent ⏫ ⏳ 2026-07-18 🛫 2026-07-16 📅 2026-07-20 ➕ 2026-07-15 ✅ 2026-07-19 🆔 release-1');
		expect(parseTasksLine(line)?.title).toBe('发布版本');
	});

	it('edits title and completion without losing metadata', () => {
		const source = '- [ ] 原标题 #release 📅 2026-07-20 🆔 abc123';
		expect(updateTasksLineTitle(source, '新标题')).toBe('- [ ] 新标题 #release 📅 2026-07-20 🆔 abc123');
		expect(updateTasksLineCompletion(source, true, '2026-07-19')).toBe('- [x] 原标题 #release 📅 2026-07-20 ✅ 2026-07-19 🆔 abc123');
	});

	it('accepts plain Markdown checklists without metadata', () => {
		expect(parseTasksLine('  * [ ] 普通任务')).toMatchObject({ marker: '*', title: '普通任务', priority: 'normal', tags: [] });
		expect(parseTasksLine('not a task')).toBeNull();
	});

	it('round-trips typed custom metadata as Tasks-compatible reserved tags', () => {
		const line = serializeTasksLine({
			marker: '-', status: ' ', completed: false, title: '检查风险', priority: 'normal', tags: ['release'],
			scheduledDate: null, startDate: null, dueDate: null, createdDate: null, doneDate: null,
			cancelledDate: null, id: 'risk-1', custom: { severity: 'critical', points: 8, approved: true },
		});
		expect(line).toContain('#op-meta/');
		expect(parseTasksLine(line)).toMatchObject({
			title: '检查风险', tags: ['release'], custom: { severity: 'critical', points: 8, approved: true },
		});
	});
});
