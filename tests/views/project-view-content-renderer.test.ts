// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderProjectViewContent, type ProjectViewMode } from '../../src/views/project-view-content-renderer';

describe('project view content renderer boundary', () => {
	it.each(['list', 'board', 'calendar', 'quadrants'] as const)('routes %s mode to only its renderer', (mode) => {
		const oldContent = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		oldContent.className = 'op-project-content';
		oldContent.textContent = 'Stale';
		document.body.append(oldContent);
		const renderers = {
			renderList: vi.fn(),
			renderBoard: vi.fn(),
			renderCalendar: vi.fn(),
			renderQuadrants: vi.fn(),
		};
		renderProjectViewContent({ container: document.body, mode, tasks: [], ...renderers });
		expect(document.body.textContent).not.toContain('Stale');
		expect(document.querySelector('.op-results-bar strong')?.textContent).toBe('0 个任务');
		const expected = `render${mode === 'quadrants' ? 'Quadrants' : `${mode[0]?.toUpperCase()}${mode.slice(1)}`}` as keyof typeof renderers;
		for (const [name, renderer] of Object.entries(renderers)) {
			expect(renderer).toHaveBeenCalledTimes(name === expected ? 1 : 0);
		}
		document.body.replaceChildren();
	});

	it('exposes all supported modes through a closed type', () => {
		const modes: ProjectViewMode[] = ['list', 'board', 'calendar', 'quadrants'];
		expect(modes).toHaveLength(4);
	});
});
