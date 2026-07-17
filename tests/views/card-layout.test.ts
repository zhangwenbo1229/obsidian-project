import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

function ruleFor(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'u').exec(css)?.[1] ?? '';
}

describe('task card layout', () => {
	it('keeps dashboard heading labels independent from configurable body text size', () => {
		expect(css).toMatch(/\.op-dashboard-card \.op-dashboard-card-heading[^{]*\{[^}]*font-size:\s*var\(--font-ui-small\)[^}]*!important/u);
		expect(ruleFor('.op-dashboard-card')).toMatch(/font-size:\s*var\(--op-dashboard-card-font-size\)/u);
	});
	it('renders four-quadrant tasks as cards instead of tables', () => {
		expect(css).toContain('.op-quadrant-card');
		expect(css).toContain('.op-quadrant-card-list');
		expect(ruleFor('.op-quadrant-region')).toMatch(/container-type:\s*inline-size/u);
		expect(ruleFor('.op-quadrant-card-list')).toMatch(/repeat\(auto-fit,\s*minmax\(/u);
		expect(ruleFor('.op-quadrant-card-meta')).toMatch(/flex-wrap:\s*wrap/u);
		expect(css).toContain('@container');
	});

	it.each(['.op-task-card', '.op-board-card'])(
		'lets %s grow with its content instead of inheriting Obsidian button height',
		(selector) => {
			const rule = ruleFor(selector);
			expect(rule).toMatch(/display:\s*grid/u);
			expect(rule).toMatch(/height:\s*auto/u);
			expect(rule).toMatch(/min-height:\s*0/u);
			expect(rule).toMatch(/align-items:\s*stretch/u);
			expect(rule).toMatch(/align-content:\s*start/u);
			if (selector === '.op-task-card') expect(rule).toMatch(/grid-template-rows:\s*repeat\(3,\s*auto\)/u);
			expect(rule).toMatch(selector === '.op-board-card' ? /overflow:\s*visible/u : /overflow:\s*hidden/u);
			expect(rule).toMatch(/white-space:\s*normal/u);
		},
	);

	it('keeps board key and title on one header line and avoids unnecessary card dividers', () => {
		const source = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');
		const project = readFileSync(new URL('../../src/views/project-view.ts', import.meta.url), 'utf8');
		expect(source).toContain('op-task-card-heading-line');
		expect(project).toContain('keyTitleInline: true');
		expect(ruleFor('.op-task-card-heading-line')).toMatch(/display:\s*flex/u);
		expect(ruleFor('.op-task-card-heading-line')).toMatch(/flex-wrap:\s*nowrap/u);
		expect(css).not.toMatch(/\.op-card-field\.is-relations,[\s\S]{0,300}border-top:/u);
	});

	it('keeps list horizontal scrolling visible inside constrained project surfaces', () => {
		const source = readFileSync(new URL('../../src/views/project-list-renderer.ts', import.meta.url), 'utf8');
		expect(ruleFor('.op-project-content')).toMatch(/min-width:\s*0/u);
		expect(ruleFor('.op-mode-surface')).toMatch(/min-width:\s*0/u);
		expect(ruleFor('.op-list-scroll')).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/u);
		expect(ruleFor('.op-list-scroll-viewport')).toMatch(/overflow:\s*auto/u);
		expect(ruleFor('.op-list-scrollbar')).toMatch(/overflow-x:\s*scroll/u);
		expect(source).toContain('op-list-scroll-viewport');
		expect(source).toContain('op-list-scrollbar');
		expect(source).toContain('syncingHorizontalScroll');
	});

	it('aligns rendered Markdown task checkboxes with their text', () => {
		const source = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');
		const helperUrl = new URL('../../src/views/subtask-presentation.ts', import.meta.url);
		expect(existsSync(helperUrl)).toBe(true);
		if (!existsSync(helperUrl)) return;
		const helper = readFileSync(helperUrl, 'utf8');
		expect(css).toMatch(/\.op-card-markdown \.task-list-item\s*\{[^}]*display:\s*flex[^}]*align-items:\s*flex-start/u);
		expect(css).toMatch(/\.op-card-markdown \.task-list-item-checkbox\s*\{[^}]*position:\s*static/u);
		expect(source).toContain('enhanceRenderedTaskLists');
		expect(helper).toContain("setIcon(marker, 'check')");
		expect(helper).toContain("toggleClass('is-checked'");
		expect(css).toMatch(/\.op-card-markdown \.task-list-item\.is-checked \.op-task-list-content\s*\{[^}]*text-decoration:\s*line-through/u);
		expect(css).toMatch(/\.op-task-checkbox-marker\s*\{[^}]*position:\s*absolute/u);
	});

	it('keeps project cards and embedded task controls shadowless and left aligned', () => {
		for (const selector of ['.op-task-card', '.op-board-card', '.op-calendar-task', '.op-quadrant-card']) {
			expect(ruleFor(selector)).toMatch(/box-shadow:\s*none/u);
		}
		expect(ruleFor('.op-embedded-subtask-content')).toMatch(/justify-content:\s*stretch/u);
		expect(ruleFor('.op-embedded-subtask-content')).toMatch(/justify-items:\s*start/u);
		expect(ruleFor('.op-embedded-subtask-content')).toMatch(/box-shadow:\s*none/u);
	});

	it('lets calendar cards use their own content height within a shared lane', () => {
		const rule = ruleFor('.op-calendar-task');
		expect(rule).toMatch(/height:\s*auto/u);
		expect(rule).toMatch(/overflow:\s*visible/u);
		expect(rule).toMatch(/align-self:\s*start/u);
	});

	it('contains embedded task metadata on a separate transparent responsive line', () => {
		expect(ruleFor('.op-embedded-subtask')).toMatch(/min-width:\s*0/u);
		expect(ruleFor('.op-embedded-subtask')).toMatch(/max-width:\s*100%/u);
		expect(ruleFor('.op-embedded-subtask-content')).toMatch(/display:\s*grid/u);
		expect(ruleFor('.op-embedded-subtask-content')).toMatch(/background:\s*transparent\s*!important/u);
		expect(ruleFor('.op-embedded-subtask .op-task-metadata')).toMatch(/grid-row:\s*2/u);
		expect(ruleFor('.op-embedded-subtask .op-task-metadata')).toMatch(/flex-wrap:\s*wrap/u);
	});
});
