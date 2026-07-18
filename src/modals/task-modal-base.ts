import { Modal, Setting } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { MarkdownEditorHandle } from './markdown-editor';
import { renderMarkdownEditor } from './markdown-editor';
import type { TaskFormField, TaskTypeDefinition } from '../domain/types';
import { taskFieldEnabled, taskFieldOptions, taskFieldRule } from '../settings/task-field-configuration';
import { renderSubtaskListEditor } from './subtask-list-editor';
import {
	fieldSetting,
	renderCustomFields,
	renderDateFields,
	renderReporterField,
	renderAssigneeField,
	renderTagsField,
} from './task-form-fields';

export interface SharedTaskFormState {
	title: string;
	taskTypeId: string;
	priority: string;
	reporterId: string;
	assigneeId: string | null;
	scheduledDate: string | null;
	startDate: string | null;
	dueDate: string | null;
	endDate: string | null;
	tags: string[];
	custom: Record<string, unknown>;
	body: string;
	links: string;
	subtasks: string;
}

export interface TaskFormContext {
	manager: ProjectManager;
	state: SharedTaskFormState;
	project: { taskTypes: TaskTypeDefinition[] } | undefined;
	taskType: TaskTypeDefinition | undefined;
	isCreate: boolean;
	sourcePath: string;
	onTitleChange: (value: string) => void;
	onPriorityChange: (value: string) => void;
	onReporterChange: (value: string) => void;
	onAssigneeChange: (value: string | null) => void;
	onDateChange: (field: 'scheduledDate' | 'startDate' | 'dueDate' | 'endDate', value: string | null) => void;
	onTagsChange: (tags: string[]) => void;
	onCustomFieldChange: (key: string, value: unknown) => void;
	onBodyChange: (value: string) => void;
	onLinksChange: (value: string) => void;
	onSubtasksChange: (value: string) => void;
	onRerender: () => void;
	renderRelations?: (container: HTMLElement) => void;
	renderNotes?: (container: HTMLElement) => void;
}

export abstract class TaskModalBase extends Modal {
	protected markdownEditors: MarkdownEditorHandle[] = [];

	constructor(protected readonly manager: ProjectManager) {
		super(manager.app);
	}

	protected clearMarkdownEditors(): void {
		for (const editor of this.markdownEditors) editor.unload();
		this.markdownEditors = [];
	}

	protected renderCommonSections(
		shell: { createSection: (title: string, className?: string, presentation?: ReturnType<typeof taskFieldRule>) => HTMLElement },
		ctx: TaskFormContext,
	): void {
		const taskType = ctx.taskType;
		const presentation = (field: TaskFormField) => taskFieldRule(taskType, field);

		// 基本信息
		const identityEl = shell.createSection('基本信息');
		if (taskFieldEnabled(taskType, 'title')) fieldSetting(identityEl, '标题', taskType, 'title').addText((text) =>
			text.setValue(ctx.state.title).onChange(ctx.onTitleChange),
		);
		if (taskFieldEnabled(taskType, 'priority')) fieldSetting(identityEl, '优先级', taskType, 'priority').addDropdown((dropdown) => {
			for (const option of taskFieldOptions(taskType, 'priority')) dropdown.addOption(option.id, option.name);
			dropdown.setValue(ctx.state.priority).onChange(ctx.onPriorityChange);
		});

		// 计划与人员
		const planningEl = shell.createSection('计划与人员');
		renderReporterField(planningEl, taskType, ctx.manager.globalConfig.people, ctx.state.reporterId, ctx.onReporterChange);
		renderAssigneeField(planningEl, taskType, ctx.manager.globalConfig.people, ctx.state.assigneeId, ctx.onAssigneeChange);
		renderDateFields(planningEl, taskType, {
			scheduledDate: ctx.state.scheduledDate,
			startDate: ctx.state.startDate,
			dueDate: ctx.state.dueDate,
			endDate: ctx.state.endDate,
		}, ctx.onDateChange);
		renderTagsField(planningEl, taskType, ctx.manager, ctx.state.tags, ctx.onTagsChange);
		renderCustomFields(planningEl, ctx.project as any, ctx.state.taskTypeId, ctx.state.custom, ctx.manager, ctx.onCustomFieldChange);

		// 项目描述
		if (taskFieldEnabled(taskType, 'body')) {
			const bodyEl = shell.createSection('项目描述', 'op-task-dialog-section-wide', presentation('body'));
			this.markdownEditors.push(renderMarkdownEditor({
				app: ctx.manager.app,
				container: bodyEl,
				value: ctx.state.body,
				onChange: ctx.onBodyChange,
				sourcePath: ctx.sourcePath,
				placeholder: '使用 Markdown 编写任务背景、目标和验收说明。',
			}));
		}

		// 链接
		if (taskFieldEnabled(taskType, 'links')) {
			const linksEl = shell.createSection('链接', 'op-task-dialog-section-wide', presentation('links'));
			new Setting(linksEl)
				.setName('Markdown 链接')
				.setDesc(ctx.isCreate ? '每行一个 wikilink、Markdown 链接或普通 URL。' : '结构化项目关系在下方单独管理；这里保留普通 wikilink 和 URL。')
				.addTextArea((area) => {
					area.inputEl.addClass('op-markdown-editor', 'is-compact');
					area.setPlaceholder('- [[相关文档]]').setValue(ctx.state.links).onChange(ctx.onLinksChange);
				});
		}

		// 子任务
		if (taskFieldEnabled(taskType, 'subtasks')) {
			const subtasksEl = shell.createSection('任务', 'op-task-dialog-section-wide', presentation('subtasks'));
			renderSubtaskListEditor(subtasksEl, {
				manager: ctx.manager,
				value: ctx.state.subtasks,
				parent: null,
				parentLabel: ctx.state.title.trim() ? `未保存项目 · ${ctx.state.title.trim()}` : '当前未保存项目',
				onChange: ctx.onSubtasksChange,
				onRerender: ctx.onRerender,
			});
		}

		// 项目关系
		if (taskFieldEnabled(taskType, 'relations') && ctx.renderRelations) {
			const relationsEl = shell.createSection('项目关系', 'op-task-dialog-section-wide', presentation('relations'));
			ctx.renderRelations(relationsEl);
		}

		// 备注
		if (taskFieldEnabled(taskType, 'notes') && ctx.renderNotes) {
			const notesEl = shell.createSection('备注', 'op-task-dialog-section-wide', presentation('notes'));
			ctx.renderNotes(notesEl);
		}
	}
}