import { Modal, Notice, Setting } from 'obsidian';
import { availableTransitions, transitionTask } from '../domain/workflow';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { localDateTime } from '../utils/dates';
import { createUuid } from '../utils/ids';
import { MigrationModal } from './migration-modal';
import type { TaskFormField } from '../domain/types';
import { buildTaskDialogShell } from './task-dialog';
import { resolveTaskTypeTemplate, switchTaskTypeDraft } from '../services/task-service';
import { renderMarkdownEditor, type MarkdownEditorHandle } from './markdown-editor';
import { taskFieldEnabled, taskFieldOptions, taskFieldRule } from '../settings/task-field-configuration';
import { validateConfiguredTaskFields } from '../services/task-field-validation';
import { renderSubtaskListEditor } from './subtask-list-editor';
import {
	fieldSetting,
	renderCustomFields,
	renderDateFields,
	renderReporterField,
	renderAssigneeField,
	renderTagsField,
} from './task-form-fields';

export class EditTaskModal extends Modal {
	private document;
	private relationTargetUid = '';
	private newNote = '';
	private noteAuthorId: string;
	private deleteArmed = false;
	private bodyDrafts: Record<string, string>;
	private markdownEditors: MarkdownEditorHandle[] = [];

	constructor(
		private readonly manager: ProjectManager,
		private readonly entry: IndexedTask,
	) {
		super(manager.app);
		this.document = structuredClone(entry.document);
		this.noteAuthorId = manager.globalConfig.currentUserId;
		this.bodyDrafts = { [entry.document.metadata.taskTypeId]: entry.document.body };
	}

	onOpen(): void {
		this.setTitle('编辑项目');
		this.render();
	}

	onClose(): void {
		this.clearMarkdownEditors();
	}

	private render(): void {
		this.clearMarkdownEditors();
		const shell = buildTaskDialogShell(this.contentEl, {
			subtitle: this.document.metadata.uid,
		});
		const taskType = this.currentTaskType();
		const presentation = (field: TaskFormField) => taskFieldRule(taskType, field);
		const identityEl = shell.createSection('基本信息');
		const planningEl = shell.createSection('计划与人员');
		const bodyEl = taskFieldEnabled(taskType, 'body') ? shell.createSection('项目描述', 'op-task-dialog-section-wide', presentation('body')) : null;
		const linksEditorEl = taskFieldEnabled(taskType, 'links') ? shell.createSection('链接', 'op-task-dialog-section-wide', presentation('links')) : null;
		const subtasksEl = taskFieldEnabled(taskType, 'subtasks') ? shell.createSection('任务', 'op-task-dialog-section-wide', presentation('subtasks')) : null;
		const workflowEl = shell.createSection('工作流', 'op-task-dialog-section-wide');
		const relationsEl = taskFieldEnabled(taskType, 'relations') ? shell.createSection('项目关系', 'op-task-dialog-section-wide', presentation('relations')) : null;
		const notesEl = taskFieldEnabled(taskType, 'notes') ? shell.createSection('备注', 'op-task-dialog-section-wide', presentation('notes')) : null;

		if (taskFieldEnabled(taskType, 'title')) fieldSetting(identityEl, '标题', taskType, 'title').addText((text) =>
			text.setValue(this.document.metadata.title).onChange((value) => (this.document.metadata.title = value)),
		);
		new Setting(identityEl).setName('任务类型').addDropdown((dropdown) => {
			for (const type of this.entry.project.taskTypes) dropdown.addOption(type.id, type.name);
			dropdown.setValue(this.document.metadata.taskTypeId).onChange((value) => {
				const taskType = this.entry.project.taskTypes.find((type) => type.id === value);
				const switched = switchTaskTypeDraft(
					this.bodyDrafts,
					this.document.metadata.taskTypeId,
					this.document.body,
					value,
					taskType ? resolveTaskTypeTemplate(taskType) : null,
				);
				this.bodyDrafts = switched.drafts;
				this.document.metadata.taskTypeId = value;
				this.document.body = switched.body;
				this.render();
			});
		});
		if (taskFieldEnabled(taskType, 'priority')) fieldSetting(identityEl, '优先级', taskType, 'priority').addDropdown((dropdown) => {
			const options = taskFieldOptions(taskType, 'priority');
			for (const option of options) dropdown.addOption(option.id, option.name);
			const current = this.document.metadata.priority;
			if (current && !options.some((option) => option.id === current)) dropdown.addOption(current, `${current}（当前值）`);
			dropdown.setValue(current ?? options[0]?.id ?? 'medium')
				.onChange((value) => (this.document.metadata.priority = value));
		});

		renderReporterField(planningEl, taskType, this.manager.globalConfig.people, this.document.metadata.reporterId, (v) => (this.document.metadata.reporterId = v));
		renderAssigneeField(planningEl, taskType, this.manager.globalConfig.people, this.document.metadata.assigneeId ?? null, (v) => (this.document.metadata.assigneeId = v));
		renderDateFields(planningEl, taskType, {
			scheduledDate: this.document.metadata.scheduledDate ?? null,
			startDate: this.document.metadata.startDate,
			dueDate: this.document.metadata.dueDate,
			endDate: this.document.metadata.endDate ?? null,
		}, (field, value) => { (this.document.metadata as unknown as Record<string, unknown>)[field] = value; });
		renderTagsField(planningEl, taskType, this.manager, this.document.metadata.tags, (tags) => (this.document.metadata.tags = tags));
		renderCustomFields(planningEl, this.entry.project, this.document.metadata.taskTypeId, this.document.metadata.custom, this.manager, (key, value) => (this.document.metadata.custom[key] = value));

		if (bodyEl) this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container: bodyEl,
			value: this.document.body,
			onChange: (value) => (this.document.body = value),
			sourcePath: this.entry.path,
			placeholder: '使用 Markdown 编写任务背景、目标和验收说明。',
		}));
		if (linksEditorEl) new Setting(linksEditorEl)
			.setName('Markdown 链接')
			.setDesc('结构化项目关系在下方单独管理；这里保留普通 wikilink 和 URL。')
			.addTextArea((area) => {
				area.inputEl.addClass('op-markdown-editor', 'is-compact');
				area.setValue(this.document.unknownLinks.join('\n')).onChange((value) => {
					this.document.unknownLinks = value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
				});
			});
		if (subtasksEl) this.renderSubtasks(subtasksEl);

		const transitions = availableTransitions(this.document.metadata.statusId, this.entry.project.workflow);
		const transitionSetting = new Setting(workflowEl).setName('状态转换');
		for (const transition of transitions) {
			transitionSetting.addButton((button) => button.setButtonText(transition.name).onClick(() => {
				this.document.metadata = transitionTask(this.document.metadata, this.entry.project.workflow, transition.to);
				this.render();
			}));
		}
		for (const relation of relationsEl ? this.document.relations.filter((item) => item.type === 'related') : []) {
			new Setting(relationsEl!)
				.setName(`关联 · ${relation.targetKey}`)
				.setDesc(relation.targetTitle)
				.addButton((button) => button.setIcon('trash').setTooltip('删除关系').onClick(() => {
					this.document.relations = this.document.relations.filter((item) => item.id !== relation.id);
					this.render();
				}));
		}
		for (const related of relationsEl ? this.manager.index.relatedTo(this.document.metadata.uid) : []) {
			if (this.document.relations.some((relation) => relation.targetUid === related.document.metadata.uid)) continue;
			new Setting(relationsEl!).setName(`反向关联 · ${related.document.metadata.key}`).setDesc(related.document.metadata.title);
		}
		const candidates = this.manager.index.validTasks().filter((task) => task.document.metadata.uid !== this.document.metadata.uid);
		if (relationsEl) new Setting(relationsEl)
			.setName('添加关联项目')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '选择项目');
				for (const task of candidates) dropdown.addOption(task.document.metadata.uid, `${task.document.metadata.key} · ${task.document.metadata.title}`);
				dropdown.setValue(this.relationTargetUid).onChange((value) => (this.relationTargetUid = value));
			})
			.addButton((button) => button.setButtonText('添加').onClick(() => this.addRelation()));

		for (const note of notesEl ? this.document.notes : []) {
			new Setting(notesEl!)
				.setName(`${note.createdAt} · ${note.authorName}`)
				.addButton((button) => button.setIcon('trash').setTooltip('删除备注').onClick(() => {
					this.document.notes = this.document.notes.filter((item) => item.id !== note.id);
					this.render();
				}));
			this.markdownEditors.push(renderMarkdownEditor({
				app: this.manager.app,
				container: notesEl!,
				value: note.content,
				onChange: (value) => (note.content = value),
				sourcePath: this.entry.path,
				initialMode: 'preview',
			}));
		}
		if (notesEl) new Setting(notesEl)
			.setName('新增备注')
			.addDropdown((dropdown) => {
				for (const person of this.manager.globalConfig.people.filter((item) => item.active)) dropdown.addOption(person.id, person.name);
				dropdown.setValue(this.noteAuthorId).onChange((value) => (this.noteAuthorId = value));
			})
			.addButton((button) => button.setButtonText('添加').onClick(() => this.addNote()));
		if (notesEl) this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container: notesEl,
			value: this.newNote,
			onChange: (value) => (this.newNote = value),
			sourcePath: this.entry.path,
			placeholder: '输入 Markdown 备注后选择添加。',
		}));
		new Setting(shell.footerEl)
			.addButton((button) => button.setButtonText('在 Markdown 中打开').onClick(() => {
				this.close();
				void this.manager.openTask(this.entry.path);
			}))
			.addButton((button) => button.setButtonText('迁移项目').onClick(() => new MigrationModal(this.manager, this.entry).open()))
			.addButton((button) => button.setWarning().setButtonText(this.deleteArmed ? '再次选择确认删除' : '删除任务').onClick(() => {
				if (!this.deleteArmed) { this.deleteArmed = true; this.render(); return; }
				void this.deleteTask();
			}))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private renderSubtasks(container: HTMLElement): void {
		renderSubtaskListEditor(container, {
			manager: this.manager,
			value: this.document.subtasks ?? '',
			parent: this.entry,
			parentLabel: `${this.entry.document.metadata.key} · ${this.document.metadata.title}`,
			onChange: (value) => (this.document.subtasks = value),
			onRerender: () => this.render(),
		});
	}

	private addRelation(): void {
		const target = this.manager.index.get(this.relationTargetUid);
		if (!target) return;
		if (this.document.relations.some((relation) => relation.type === 'related' && relation.targetUid === target.document.metadata.uid)) return;
		this.document.relations.push({
			id: createUuid(), type: 'related', targetUid: target.document.metadata.uid,
			targetKey: target.document.metadata.key, targetTitle: target.document.metadata.title,
		});
		this.relationTargetUid = '';
		this.render();
	}

	private currentTaskType() {
		return this.entry.project.taskTypes.find((type) => type.id === this.document.metadata.taskTypeId);
	}

	private clearMarkdownEditors(): void {
		for (const editor of this.markdownEditors) editor.unload();
		this.markdownEditors = [];
	}

	private addNote(): void {
		if (!this.newNote.trim()) return;
		const author = this.manager.globalConfig.people.find((person) => person.id === this.noteAuthorId);
		this.document.notes.push({
			id: createUuid(), authorId: this.noteAuthorId,
			authorName: author?.name ?? '未知用户', createdAt: localDateTime(), content: this.newNote.trim(),
		});
		this.newNote = '';
		this.render();
	}

	private async save(): Promise<void> {
		const configuredIssues = validateConfiguredTaskFields(this.currentTaskType(), {
			title: this.document.metadata.title,
			priority: this.document.metadata.priority,
			reporter: this.document.metadata.reporterId,
			assignee: this.document.metadata.assigneeId,
			scheduledDate: this.document.metadata.scheduledDate ?? null,
			startDate: this.document.metadata.startDate,
			dueDate: this.document.metadata.dueDate,
			endDate: this.document.metadata.endDate ?? null,
			tags: this.document.metadata.tags,
			body: this.document.body,
			links: this.document.unknownLinks,
			subtasks: this.document.subtasks,
			relations: this.document.relations.filter((relation) => relation.type === 'related'),
			notes: this.document.notes,
			customFields: this.document.metadata.custom,
		});
		if (configuredIssues.length > 0) {
			new Notice(configuredIssues.join('\n'));
			return;
		}
		try {
			await this.manager.saveTask(this.entry, this.document);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async deleteTask(): Promise<void> {
		try {
			await this.manager.deleteTask(this.entry);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}