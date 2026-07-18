import { Notice, Setting } from 'obsidian';
import { availableTransitions, transitionTask } from '../domain/workflow';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { localDateTime } from '../utils/dates';
import { createUuid } from '../utils/ids';
import { MigrationModal } from './migration-modal';
import { buildTaskDialogShell } from './task-dialog';
import { resolveTaskTypeTemplate, switchTaskTypeDraft } from '../services/task-service';
import { renderMarkdownEditor } from './markdown-editor';
import { validateConfiguredTaskFields } from '../services/task-field-validation';
import { TaskModalBase, type SharedTaskFormState, type TaskFormContext } from './task-modal-base';

export class EditTaskModal extends TaskModalBase {
	private document;
	private relationTargetUid = '';
	private newNote = '';
	private noteAuthorId: string;
	private deleteArmed = false;
	private bodyDrafts: Record<string, string>;

	constructor(
		manager: ProjectManager,
		private readonly entry: IndexedTask,
	) {
		super(manager);
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

		// 任务类型（Edit 特有）
		const identityEl = shell.createSection('基本信息');
		new Setting(identityEl).setName('任务类型').addDropdown((dropdown) => {
			for (const type of this.entry.project.taskTypes) dropdown.addOption(type.id, type.name);
			dropdown.setValue(this.document.metadata.taskTypeId).onChange((value) => {
				const taskType = this.entry.project.taskTypes.find((type) => type.id === value);
				const switched = switchTaskTypeDraft(
					this.bodyDrafts, this.document.metadata.taskTypeId, this.document.body,
					value, taskType ? resolveTaskTypeTemplate(taskType) : null,
				);
				this.bodyDrafts = switched.drafts;
				this.document.metadata.taskTypeId = value;
				this.document.body = switched.body;
				this.render();
			});
		});

		// 共享表单字段
		const ctx: TaskFormContext = {
			manager: this.manager,
			state: this.buildFormState(),
			project: this.entry.project,
			taskType,
			isCreate: false,
			sourcePath: this.entry.path,
			onTitleChange: (v) => (this.document.metadata.title = v),
			onPriorityChange: (v) => (this.document.metadata.priority = v),
			onReporterChange: (v) => (this.document.metadata.reporterId = v),
			onAssigneeChange: (v) => (this.document.metadata.assigneeId = v),
			onDateChange: (field, value) => { (this.document.metadata as unknown as Record<string, unknown>)[field] = value; },
			onTagsChange: (tags) => (this.document.metadata.tags = tags),
			onCustomFieldChange: (key, value) => (this.document.metadata.custom[key] = value),
			onBodyChange: (v) => (this.document.body = v),
			onLinksChange: (v) => { this.document.unknownLinks = v.split(/\r?\n/u).map((l) => l.trim()).filter(Boolean); },
			onSubtasksChange: (v) => (this.document.subtasks = v),
			onRerender: () => this.render(),
			renderRelations: (container) => this.renderRelations(container),
			renderNotes: (container) => this.renderNotes(container),
		};
		this.renderCommonSections(shell, ctx);

		// 工作流（Edit 特有）
		const workflowEl = shell.createSection('工作流', 'op-task-dialog-section-wide');
		const transitions = availableTransitions(this.document.metadata.statusId, this.entry.project.workflow);
		const transitionSetting = new Setting(workflowEl).setName('状态转换');
		for (const transition of transitions) {
			transitionSetting.addButton((button) => button.setButtonText(transition.name).onClick(() => {
				this.document.metadata = transitionTask(this.document.metadata, this.entry.project.workflow, transition.to);
				this.render();
			}));
		}

		// 页脚按钮（Edit 特有）
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

	private buildFormState(): SharedTaskFormState {
		return {
			title: this.document.metadata.title,
			taskTypeId: this.document.metadata.taskTypeId,
			priority: this.document.metadata.priority ?? 'medium',
			reporterId: this.document.metadata.reporterId,
			assigneeId: this.document.metadata.assigneeId ?? null,
			scheduledDate: this.document.metadata.scheduledDate ?? null,
			startDate: this.document.metadata.startDate,
			dueDate: this.document.metadata.dueDate,
			endDate: this.document.metadata.endDate ?? null,
			tags: this.document.metadata.tags,
			custom: this.document.metadata.custom,
			body: this.document.body,
			links: this.document.unknownLinks.join('\n'),
			subtasks: this.document.subtasks ?? '',
		};
	}

	private currentTaskType() {
		return this.entry.project.taskTypes.find((type) => type.id === this.document.metadata.taskTypeId);
	}

	private renderRelations(container: HTMLElement): void {
		for (const relation of this.document.relations.filter((item) => item.type === 'related')) {
			new Setting(container)
				.setName(`关联 · ${relation.targetKey}`)
				.setDesc(relation.targetTitle)
				.addButton((button) => button.setIcon('trash').setTooltip('删除关系').onClick(() => {
					this.document.relations = this.document.relations.filter((item) => item.id !== relation.id);
					this.render();
				}));
		}
		for (const related of this.manager.index.relatedTo(this.document.metadata.uid)) {
			if (this.document.relations.some((r) => r.targetUid === related.document.metadata.uid)) continue;
			new Setting(container).setName(`反向关联 · ${related.document.metadata.key}`).setDesc(related.document.metadata.title);
		}
		const candidates = this.manager.index.validTasks().filter((task) => task.document.metadata.uid !== this.document.metadata.uid);
		new Setting(container)
			.setName('添加关联项目')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '选择项目');
				for (const task of candidates) dropdown.addOption(task.document.metadata.uid, `${task.document.metadata.key} · ${task.document.metadata.title}`);
				dropdown.setValue(this.relationTargetUid).onChange((value) => (this.relationTargetUid = value));
			})
			.addButton((button) => button.setButtonText('添加').onClick(() => this.addRelation()));
	}

	private renderNotes(container: HTMLElement): void {
		for (const note of this.document.notes) {
			new Setting(container)
				.setName(`${note.createdAt} · ${note.authorName}`)
				.addButton((button) => button.setIcon('trash').setTooltip('删除备注').onClick(() => {
					this.document.notes = this.document.notes.filter((item) => item.id !== note.id);
					this.render();
				}));
			this.markdownEditors.push(renderMarkdownEditor({
				app: this.manager.app,
				container,
				value: note.content,
				onChange: (value) => (note.content = value),
				sourcePath: this.entry.path,
				initialMode: 'preview',
			}));
		}
		new Setting(container)
			.setName('新增备注')
			.addDropdown((dropdown) => {
				for (const person of this.manager.globalConfig.people.filter((item) => item.active)) dropdown.addOption(person.id, person.name);
				dropdown.setValue(this.noteAuthorId).onChange((value) => (this.noteAuthorId = value));
			})
			.addButton((button) => button.setButtonText('添加').onClick(() => this.addNote()));
		this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container,
			value: this.newNote,
			onChange: (value) => (this.newNote = value),
			sourcePath: this.entry.path,
			placeholder: '输入 Markdown 备注后选择添加。',
		}));
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