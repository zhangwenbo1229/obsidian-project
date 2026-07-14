import { describe, expect, it } from 'vitest';
import { collectIncompleteTodos, extractIncompleteTodos, isTodoPathInScope } from '../../src/views/dashboard-modules/todo-model';

describe('dashboard todo model', () => {
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
});
