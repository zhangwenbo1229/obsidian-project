import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const settings = readFileSync(new URL('../../src/settings/settings-tab.ts', import.meta.url), 'utf8');
const templateEditor = readFileSync(new URL('../../src/settings/template-editor.ts', import.meta.url), 'utf8');
const workflowEditor = readFileSync(new URL('../../src/settings/workflow-editor.ts', import.meta.url), 'utf8');
const projectEditor = readFileSync(new URL('../../src/modals/project-config-modal.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('template configuration UI', () => {
	it('supports catalog editing and graphical workflows while projects select a template', () => {
		expect(settings).toContain('TemplateSettingsEditor');
		expect(templateEditor).not.toContain('addTaskType');
		expect(templateEditor).toContain('addTemplate');
		expect(css).toContain('grid-template-rows');
		expect(workflowEditor).toContain('op-workflow-canvas');
		expect(projectEditor).toContain('templateId');
		expect(css).toContain('.op-workflow-node');
		expect(templateEditor).toContain("setName('任务标识')");
		expect(templateEditor).toContain("setName('任务标题颜色')");
		expect(templateEditor).toContain('TaskMarkerPickerModal');
		expect(templateEditor).toContain('CUSTOM_FIELD_TYPE_LABELS');
		expect(templateEditor).toContain("'multiline-text': '多行文本'");
		expect(workflowEditor).toContain('op-workflow-stage');
		expect(workflowEditor).toContain("addEventListener('pointerdown'");
		expect(workflowEditor).toContain('connectWorkflowStatuses');
	});
});
