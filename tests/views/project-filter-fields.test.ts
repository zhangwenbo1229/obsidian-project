import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROJECT_FILTER_FIELD_DEFINITIONS, ProjectFilterFields } from '../../src/views/project-filter-fields';

const projectSource = readFileSync(new URL('../../src/views/project-view.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('progressive project filters', () => {
	it('shows controls only after their fields are selected', () => {
		const fields = new ProjectFilterFields();
		expect(fields.selected()).toEqual([]);
		fields.toggle('status');
		fields.toggle('assignee');
		expect(fields.selected()).toEqual(['status', 'assignee']);
		fields.toggle('status');
		expect(fields.selected()).toEqual(['assignee']);
	});

	it('keeps picker labels and rendered control labels in one stable mapping', () => {
		expect(PROJECT_FILTER_FIELD_DEFINITIONS).toEqual([
		{ field: 'status', pickerLabel: '状态', controlLabel: '状态', kind: 'multi' },
		{ field: 'statusCategory', pickerLabel: '状态分类', controlLabel: '状态分类', kind: 'multi' },
		{ field: 'type', pickerLabel: '任务类型', controlLabel: '任务类型', kind: 'multi' },
		{ field: 'reporter', pickerLabel: '提报人', controlLabel: '提报人', kind: 'multi' },
		{ field: 'assignee', pickerLabel: '经办人', controlLabel: '经办人', kind: 'multi' },
		{ field: 'tags', pickerLabel: '标签', controlLabel: '标签', kind: 'multi' },
		{ field: 'createdAt', pickerLabel: '创建日期', controlLabel: '创建日期', kind: 'date-range' },
		{ field: 'startDate', pickerLabel: '开始日期', controlLabel: '开始日期', kind: 'date-range' },
		{ field: 'dueDate', pickerLabel: '计划完成日期', controlLabel: '计划完成日期', kind: 'date-range' },
			{ field: 'completedAt', pickerLabel: '完成日期', controlLabel: '完成日期', kind: 'date-range' },
			{ field: 'subtasks', pickerLabel: '未完成子任务', controlLabel: '未完成子任务', kind: 'boolean' },
			{ field: 'customFields', pickerLabel: '自定义字段', controlLabel: '自定义字段', kind: 'custom' },
	]);
	});

	it('keeps the selected multi-select open and its options visible in layout flow', () => {
		expect(projectSource).toContain('openFilterControlId');
		expect(projectSource).toContain("addEventListener('toggle'");
		expect(projectSource).toContain('details.open =');
		expect(css).toMatch(/\.op-multi-select-options\s*\{[^}]*position:\s*static/u);
	});

	it('adds an all-project option to the project-space selector', () => {
		expect(projectSource).toContain("text: '全部项目'");
		expect(projectSource).toContain('ALL_PROJECTS_UID');
	});

	it('keeps checkbox inputs compact so option labels remain visible', () => {
		expect(css).not.toMatch(/\.op-filter-field input\s*\{[^}]*width:\s*100%/u);
		expect(css).toContain(".op-filter-field input:not([type='checkbox'])");
		expect(css).toMatch(/\.op-multi-select-option input\[type='checkbox'\]\s*\{[^}]*width:\s*16px/u);
	});

	it('gives selected filter controls enough breathing room', () => {
		expect(css).toMatch(/\.op-filter-panel\s*\{[^}]*minmax\(240px,[^}]*column-gap:[^}]*row-gap:/u);
		expect(css).toMatch(/\.op-filter-field\s*\{[^}]*padding:/u);
	});

	it('anchors a scrollable condition picker directly below the add-filter trigger', () => {
		expect(projectSource).toContain('op-filter-trigger-wrap');
		expect(projectSource).toMatch(/renderFilterPicker\(filterTriggerWrap\)/u);
		expect(css).toMatch(/\.op-filter-trigger-wrap\s*\{[^}]*position:\s*relative/u);
		expect(css).toMatch(/\.op-filter-field-picker\s*\{[^}]*position:\s*absolute[^}]*top:\s*calc\(100%/u);
		expect(css).toMatch(/\.op-filter-field-options\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/u);
	});

	it('keeps the picker compact and lets users remove each rendered condition', () => {
		expect(projectSource).not.toContain("text: '组合筛选'");
		expect(projectSource).not.toContain('所有条件必须同时满足');
		expect(projectSource).toContain('addFilterRemoveButton');
		expect(projectSource).toContain('removeFilterField');
		expect(css).toMatch(/\.op-filter-trigger-wrap \.op-filter-field-picker\s*\{[^}]*width:\s*min\(248px/u);
		expect(css).toMatch(/\.op-filter-remove\s*\{[^}]*position:\s*absolute/u);
	});
});
