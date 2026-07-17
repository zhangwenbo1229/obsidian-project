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

	it('uses date-time scheduling controls and renders configured metadata without a fixed custom-field section', () => {
		expect(createSource).toMatch(/fieldSetting\(planningEl, '计划日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(createSource).toMatch(/fieldSetting\(planningEl, '截止日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(createSource).toMatch(/fieldSetting\(planningEl, '开始日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(createSource).toMatch(/fieldSetting\(planningEl, '结束日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(editSource).toMatch(/fieldSetting\(planningEl, '计划日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(editSource).toMatch(/fieldSetting\(planningEl, '截止日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(editSource).toMatch(/fieldSetting\(planningEl, '开始日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(editSource).toMatch(/fieldSetting\(planningEl, '结束日期',[\s\S]{0,220}inputEl\.type = 'datetime-local'/u);
		expect(createSource).not.toContain("shell.createSection('自定义字段'");
		expect(editSource).not.toContain("shell.createSection('自定义字段'");
		expect(createSource).not.toContain("taskFieldEnabled(taskType, 'customFields')");
		expect(editSource).not.toContain("taskFieldEnabled(taskType, 'customFields')");
		expect(createSource).toContain('new Setting(planningEl).setName(field.name)');
		expect(editSource).toContain('new Setting(planningEl).setName(field.name)');
	});

	it('keeps completion and termination dates workflow-owned', () => {
		for (const source of [createSource, editSource]) {
			expect(source).not.toMatch(/fieldSetting\(planningEl, '(完成日期|终止日期)'/u);
		}
		expect(editSource).not.toContain("taskFieldEnabled(taskType, 'completedAt')");
		expect(editSource).not.toContain("taskFieldEnabled(taskType, 'terminatedAt')");
	});

	it('supports Markdown subtasks, selectable note authors, and related-only task relationships', () => {
		for (const source of [createSource, editSource]) {
			expect(source).toContain("shell.createSection('任务'");
			expect(source).toContain('noteAuthorId');
			expect(source).toContain('项目关系');
			expect(source).not.toContain("addOption('parent', '父任务')");
		}
		expect(editSource).not.toContain('validateParentAssignment');
		expect(createSource).toContain('taskFieldEnabled');
		expect(editSource).toContain('taskFieldEnabled');
	});
	it('replaces the freeform task input with structured add and edit controls', () => {
		for (const source of [createSource, editSource]) expect(source).toContain('renderSubtaskListEditor');
		expect(createSource).not.toMatch(/if \(subtasksEl\) this\.markdownEditors\.push\(renderMarkdownEditor/u);
		expect(editSource).not.toContain('op-task-dialog-legacy-subtasks');
		expect(css).toMatch(/\.op-task-dialog-task-toolbar\s*\{[^}]*display:\s*flex/u);
		expect(css).toMatch(/\.op-task-dialog-task-row\s*\{[^}]*grid-template-columns:/u);
		expect(css).toMatch(/\.op-task-dialog-task-details\s*\{[^}]*min-width:\s*0/u);
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
		expect(picker).toContain('availableTagGroups');
		expect(picker).toContain('filterTagSuggestions');
		expect(picker).toContain('op-grouped-tag-picker');
		expect(picker).toContain('op-grouped-tag-picker-group-select');
		expect(picker).toContain("group.id ?? ''");
		expect(picker).not.toContain("radio.type = 'radio'");
		expect(picker).toContain("suggestions.classList.toggle('is-visible'");
		expect(picker).toContain('新建“');
	});

	it('closes the edit dialog after opening the project Markdown file', () => {
		expect(editSource).toMatch(/setButtonText\('在 Markdown 中打开'\)[\s\S]{0,160}this\.close\(\)[\s\S]{0,120}this\.manager\.openTask/u);
	});
});
