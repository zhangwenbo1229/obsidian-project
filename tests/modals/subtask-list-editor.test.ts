import { describe, expect, it } from 'vitest';
import type { EmbeddedSubtask } from '../../src/domain/types';
import { parseEmbeddedSubtasks } from '../../src/markdown/embedded-subtask-parser';
import { addDraftSubtask, deleteDraftSubtask, updateDraftSubtask } from '../../src/modals/subtask-draft';

const task = (id: string, title: string): EmbeddedSubtask => ({
	id, title, completed: false, priority: 'medium', tags: [], scheduledDate: null,
	startDate: null, dueDate: null, createdDate: '2026-07-15', doneDate: null, cancelledDate: null,
});

describe('project dialog task list editor', () => {
	it('adds, updates and removes structured task drafts without dropping legacy Markdown', () => {
		const initial = '- [ ] 保留的旧格式任务';
		const added = addDraftSubtask(initial, task('task0001', '新增任务'));
		expect(parseEmbeddedSubtasks(added)).toMatchObject({
			legacyMarkdown: initial,
			subtasks: [{ id: 'task0001', title: '新增任务' }],
		});
		const updated = updateDraftSubtask(added, task('task0001', '编辑后的任务'));
		expect(parseEmbeddedSubtasks(updated).subtasks[0]?.title).toBe('编辑后的任务');
		const removed = deleteDraftSubtask(updated, 'task0001');
		expect(parseEmbeddedSubtasks(removed)).toMatchObject({ legacyMarkdown: initial, subtasks: [] });
	});
});
