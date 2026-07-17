import { describe, expect, it } from 'vitest';
import {
	collectIncompleteTodos,
	extractIncompleteTodos,
	isTodoPathInScope,
	setMarkdownTodoCompleted,
	setMarkdownTodoText,
} from '../../src/views/dashboard-modules/todo-model';

describe('dashboard todo model', () => {
	it('separates Tasks metadata from the visible todo title', () => {
		const [todo] = extractIncompleteTodos('- [ ] 发布版本 #release 🔼 📅 2026-07-20 🆔 abc123', '项目/发布.md');
		expect(todo).toMatchObject({
			text: '发布版本', path: '项目/发布.md', line: 1,
			metadata: { priority: 'medium', dueDate: '2026-07-20', id: 'abc123', tags: ['release'] },
		});
	});

	it('preserves Tasks metadata when editing todo text', () => {
		const source = '- [ ] 旧标题 #release 📅 2026-07-20 🆔 abc123\n';
		expect(setMarkdownTodoText(source, 1, '旧标题', '新标题'))
			.toBe('- [ ] 新标题 #release 📅 2026-07-20 🆔 abc123\n');
	});
	it('extracts common incomplete Markdown task markers with line numbers', () => {
		expect(extractIncompleteTodos('- [ ] First\n* [x] Done\n+ [ ] Third\n  - [ ] Nested', 'Work/a.md')).toEqual([
			{ text: 'First', path: 'Work/a.md', line: 1 },
			{ text: 'Third', path: 'Work/a.md', line: 3 },
			{ text: 'Nested', path: 'Work/a.md', line: 4 },
		]);
	});

	it('can filter files before their contents are read', () => {
		expect(isTodoPathInScope('Work/a.md', ['Work'], ['Work/Archive'])).toBe(true);
		expect(isTodoPathInScope('Work/Archive/a.md', ['Work'], ['Work/Archive'])).toBe(false);
		expect(isTodoPathInScope('Home/a.md', ['Work'], [])).toBe(false);
	});

	it('applies root, exclusion and limit configuration', () => {
		const files = [
			{ path: 'Work/a.md', content: '- [ ] A' },
			{ path: 'Work/Archive/b.md', content: '- [ ] B' },
			{ path: 'Home/c.md', content: '- [ ] C' },
		];
		expect(collectIncompleteTodos(files, ['Work'], ['Work/Archive'], 1).map((item) => item.text)).toEqual(['A']);
	});

	it('checks only the selected Markdown task while preserving line endings and text', () => {
		const markdown = '# List\r\n  - [ ] Keep text  \r\n- [ ] Other\r\n';
		expect(setMarkdownTodoCompleted(markdown, 2, true)).toBe('# List\r\n  - [x] Keep text  \r\n- [ ] Other\r\n');
		expect(setMarkdownTodoCompleted('- [x] Done', 1, false)).toBe('- [ ] Done');
	});

	it('refuses to overwrite a stale or non-task source line', () => {
		expect(() => setMarkdownTodoCompleted('plain text', 1, true)).toThrow('不再是 Markdown 任务');
		expect(() => setMarkdownTodoCompleted('- [ ] Task', 3, true)).toThrow('不存在');
	});

	it('edits only the guarded task text and preserves Markdown syntax', () => {
		const markdown = '# List\r\n  - [x] Old text  \r\n- [ ] Other\r\n';
		expect(setMarkdownTodoText(markdown, 2, 'Old text', 'New **Markdown**')).toBe(
			'# List\r\n  - [x] New **Markdown**  \r\n- [ ] Other\r\n',
		);
		expect(() => setMarkdownTodoText('- [ ] Changed', 1, 'Old', 'New')).toThrow('已被修改');
		expect(() => setMarkdownTodoText('- [ ] Old', 1, 'Old', '   ')).toThrow('不能为空');
	});
});
