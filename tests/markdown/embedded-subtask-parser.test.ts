import { describe, expect, it } from 'vitest';
import {
	parseEmbeddedSubtasks,
	composeEmbeddedSubtaskMarkdown,
	removeEmbeddedSubtask,
	serializeEmbeddedSubtask,
	upsertEmbeddedSubtask,
} from '../../src/markdown/embedded-subtask-parser';
import type { EmbeddedSubtask } from '../../src/domain/types';

const subtask: EmbeddedSubtask = {
	id: 'release-1',
	title: '编写发布说明',
	completed: false,
	priority: 'high',
	scheduledDate: '2026-07-18',
	startDate: null,
	dueDate: '2026-07-20',
	tags: ['release'],
	createdDate: '2026-07-15',
	doneDate: null,
	cancelledDate: null,
};

describe('embedded subtask Markdown', () => {
	it('serializes a standard checkbox with compact metadata', () => {
		const line = serializeEmbeddedSubtask(subtask);
		expect(line).toBe('- [ ] 编写发布说明 #release ⏫ ⏳ 2026-07-18 📅 2026-07-20 ➕ 2026-07-15 🆔 release-1');
	});

	it('parses structured subtasks while preserving legacy Markdown', () => {
		const markdown = `说明文字\n- [ ] 普通待办\n${serializeEmbeddedSubtask(subtask)}`;
		const parsed = parseEmbeddedSubtasks(markdown);
		expect(parsed.subtasks).toEqual([subtask]);
		expect(parsed.legacyMarkdown).toBe('说明文字\n- [ ] 普通待办');
		expect(parsed.issues).toEqual([]);
	});

	it('treats invalid comments as legacy content', () => {
		const markdown = '- [ ] 无效 <!-- op-subtask: {"id":"bad"} -->';
		const parsed = parseEmbeddedSubtasks(markdown);
		expect(parsed.subtasks).toEqual([]);
		expect(parsed.legacyMarkdown).toBe(markdown);
		expect(parsed.issues[0]).toContain('元数据无效');
	});

	it('reads legacy op-subtask metadata for migration', () => {
		const markdown = '- [ ] 旧任务 <!-- op-subtask: {"id":"550e8400-e29b-41d4-a716-446655440000","priority":"high","assigneeId":null,"startDate":null,"dueDate":"2026-07-20","tags":["release"],"createdAt":"2026-07-15T09:00:00+08:00","updatedAt":"2026-07-15T09:00:00+08:00"} -->';
		const parsed = parseEmbeddedSubtasks(markdown);
		expect(parsed.subtasks[0]).toMatchObject({ title: '旧任务', priority: 'high', dueDate: '2026-07-20', createdDate: '2026-07-15' });
		expect(serializeEmbeddedSubtask(parsed.subtasks[0]!)).not.toContain('op-subtask');
	});

	it('updates and removes only the matching structured line', () => {
		const original = `前言\n${serializeEmbeddedSubtask(subtask)}\n- [ ] 保留`;
		const updated = upsertEmbeddedSubtask(original, { ...subtask, title: '完成发布说明', completed: true });
		expect(updated).toContain('- [x] 完成发布说明');
		expect(updated).toContain('前言');
		expect(updated).toContain('- [ ] 保留');
		expect(removeEmbeddedSubtask(updated, subtask.id)).toBe('前言\n- [ ] 保留');
	});

	it('rejects duplicate structured IDs', () => {
		const parsed = parseEmbeddedSubtasks(`${serializeEmbeddedSubtask(subtask)}\n${serializeEmbeddedSubtask(subtask)}`);
		expect(parsed.subtasks).toHaveLength(1);
		expect(parsed.issues).toContain(`子任务 ID 重复：${subtask.id}`);
	});

	it('recomposes edited legacy Markdown without exposing or losing metadata', () => {
		expect(composeEmbeddedSubtaskMarkdown('- [ ] 普通待办', [subtask]))
			.toBe(`- [ ] 普通待办\n${serializeEmbeddedSubtask(subtask)}`);
	});
});
