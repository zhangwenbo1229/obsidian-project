import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('group, project and task terminology', () => {
	it('uses project wording for top-level documents and group wording for configurations', () => {
		const create = source('../../src/modals/create-task-modal.ts');
		const edit = source('../../src/modals/edit-task-modal.ts');
		const projectView = source('../../src/views/project-view.ts');
		const settings = source('../../src/settings/settings-tab.ts');
		expect(create).toContain("this.setTitle('新增项目')");
		expect(edit).toContain("this.setTitle('编辑项目')");
		for (const modal of [create, edit]) {
			expect(modal).toContain("shell.createSection('项目描述'");
			expect(modal).toContain('项目关系');
			expect(modal).toContain('选择项目');
		}
		expect(projectView).toContain('个分组 · ${scopedTasks.length} 个项目');
		expect(settings).toContain("projects: '分组'");
	});

	it('uses task wording for embedded checklist items', () => {
		const create = source('../../src/modals/create-subtask-modal.ts');
		const edit = source('../../src/modals/edit-subtask-modal.ts');
		for (const modal of [create, edit]) {
			expect(modal).toMatch(/this\.setTitle\('(新增|编辑)任务'\)/u);
			expect(modal).toContain('项目');
			expect(modal).not.toContain('父任务');
		}
	});

	it('uses project wording throughout the project-template settings surface', () => {
		const settings = source('../../src/settings/settings-tab.ts');
		const editor = source('../../src/settings/template-editor.ts');
		const fields = source('../../src/settings/template-field-editor.ts');
		expect(settings).toContain("this.renderPageHeading(container, '项目模板'");
		expect(editor).toContain("text: '新增项目类型模板'");
		expect(editor).toContain("setName('项目类型')");
		expect(editor).toContain("setName('项目标识')");
		expect(editor).toContain("setName('项目标题颜色')");
		expect(fields).toContain('新增和编辑项目中');
	});
});
