import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const createSource = readFileSync(new URL('../../src/modals/create-task-modal.ts', import.meta.url), 'utf8');
const editSource = readFileSync(new URL('../../src/modals/edit-task-modal.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('task dialog layout', () => {
	it('uses the shared designed task dialog shell for create and edit', () => {
		expect(createSource).toContain('buildTaskDialogShell');
		expect(editSource).toContain('buildTaskDialogShell');
		expect(css).toContain('.op-task-dialog');
		expect(css).toContain('.op-task-dialog-grid');
		expect(createSource).toContain("shell.createSection('链接'");
		expect(createSource).toContain("shell.createSection('备注'");
		expect(css).toContain('.op-markdown-editor');
		expect(css).toContain('.op-markdown-editor-preview');
		expect(css).toContain('.op-markdown-editor-mode');
	});

	it('uses date-time scheduling controls and a responsive two-column custom field grid', () => {
		expect(createSource).toMatch(/setName\('开始日期'\)[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(createSource).toMatch(/setName\('计划完成日期'\)[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(editSource).toMatch(/setName\('开始日期'\)[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(editSource).toMatch(/setName\('计划完成日期'\)[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(createSource).toContain('op-task-custom-fields');
		expect(editSource).toContain('op-task-custom-fields');
		expect(css).toMatch(/\.op-task-custom-fields\s*\{[^}]*grid-template-columns:\s*repeat\(2/u);
	});

	it('supports Markdown subtasks, selectable note authors, and related-only task relationships', () => {
		for (const source of [createSource, editSource]) {
			expect(source).toContain("shell.createSection('子任务'");
			expect(source).toContain('noteAuthorId');
			expect(source).toContain('任务关系');
			expect(source).not.toContain("addOption('parent', '父任务')");
		}
		expect(editSource).not.toContain('validateParentAssignment');
		expect(createSource).toContain('taskFieldEnabled');
		expect(editSource).toContain('taskFieldEnabled');
	});
});

describe('grouped task tags', () => {
	it('uses the same grouped tag picker in create and edit dialogs', () => {
		const create = readFileSync(new URL('../../src/modals/create-task-modal.ts', import.meta.url), 'utf8');
		const edit = readFileSync(new URL('../../src/modals/edit-task-modal.ts', import.meta.url), 'utf8');
		const pickerUrl = new URL('../../src/modals/grouped-tag-picker.ts', import.meta.url);
		expect(existsSync(pickerUrl)).toBe(true);
		if (!existsSync(pickerUrl)) return;
		const picker = readFileSync(pickerUrl, 'utf8');
		for (const source of [create, edit]) {
			expect(source).toContain('renderGroupedTagPicker');
			expect(source).not.toContain("setDesc('使用逗号分隔')");
		}
		expect(picker).toContain('groupTags');
		expect(picker).toContain('op-grouped-tag-picker');
		expect(picker).toContain('新建标签');
	});
});
