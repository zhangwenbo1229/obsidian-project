import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('dedicated task view presentation', () => {
	it('provides scoped navigation, project grouping and task actions', () => {
		const source = readFileSync(new URL('../../src/views/task-view.ts', import.meta.url), 'utf8');
		expect(source).toContain("getDisplayText(): string { return '任务视图'; }");
		expect(source).toContain('collectTaskViewItems');
		expect(source).toContain('filterTaskViewItems');
		expect(source).toContain('groupTaskViewItems');
		expect(source).toContain('toggleCompletion');
		expect(source).toContain('EditSubtaskModal');
		expect(source).toContain('CreateSubtaskModal');
		expect(source).toContain('manager.openTask');
	});

	it('uses the shared configurable task metadata renderer', () => {
		const source = readFileSync(new URL('../../src/views/task-view.ts', import.meta.url), 'utf8');
		expect(source).toContain("renderTaskMetadata(content, item, this.manager, 'taskView'");
		expect(source).toContain('editTaskMetadataInline');
		expect(source).toContain('op-task-view-row-title-button');
	});

	it('edits task titles inline on click or double-click and reserves the modal for the context menu', () => {
		const source = readFileSync(new URL('../../src/views/task-view.ts', import.meta.url), 'utf8');
		expect(source).toContain("import { ItemView, Menu, Notice");
		expect(source).toContain("titleButton.addEventListener('click', editInline)");
		expect(source).toContain("titleButton.addEventListener('dblclick', editInline)");
		expect(source).toContain("titleButton.addEventListener('contextmenu'");
		expect(source).toContain("setTitle('编辑任务')");
		expect(source).toContain("setTitle('删除任务')");
		expect(source).toContain('deleteEmbeddedSubtask');
		expect(source).toContain('button.insertAdjacentElement');
	});

	it('supports a collapsible sidebar and shadowless project cards', () => {
		const source = readFileSync(new URL('../../src/views/task-view.ts', import.meta.url), 'utf8');
		expect(source).toContain('sidebarCollapsed');
		expect(source).toContain('op-task-view-sidebar-toggle');
		expect(source).toContain("shell.toggleClass('is-sidebar-collapsed'");
		expect(css).toMatch(/\.op-task-view-group\s*\{[^}]*border:[^}]*border-radius:[^}]*box-shadow:\s*none/u);
		expect(css).toMatch(/\.op-task-view-row-content\s*\{[^}]*justify-content:\s*stretch[^}]*justify-items:\s*start/u);
		expect(css).toMatch(/\.op-task-view-row-content,\s*\.op-task-view-group-heading,\s*\.op-task-view-sidebar-toggle,\s*\.op-task-view-source\s*\{[^}]*box-shadow:\s*none\s*!important/u);
		expect(css).toMatch(/\.op-task-view-shell\.is-sidebar-collapsed\s*\{[^}]*grid-template-columns:/u);
	});

	it('renders the task header as a hero card above the view shell', () => {
		const source = readFileSync(new URL('../../src/views/task-view.ts', import.meta.url), 'utf8');
		expect(source).toContain("cls: 'op-task-view-header op-view-hero'");
		expect(css).toMatch(/\.op-task-view-header\.op-view-hero\s*\{[^}]*margin:/u);
	});
});
