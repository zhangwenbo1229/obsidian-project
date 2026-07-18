import { Notice, Setting } from 'obsidian';
import type { ProjectConfig, ProjectPriority, TaskRelation } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { resolveTaskTypeTemplate, switchTaskTypeDraft, switchTaskTypeFieldDrafts } from '../services/task-service';
import { buildTaskDialogShell } from './task-dialog';
import { createUuid } from '../utils/ids';
import { taskFieldDefault, taskFieldOptions } from '../settings/task-field-configuration';
import { validateConfiguredTaskFields } from '../services/task-field-validation';
import { TaskModalBase, type SharedTaskFormState, type TaskFormContext } from './task-modal-base';
import { renderMarkdownEditor } from './markdown-editor';

export class CreateTaskModal extends TaskModalBase {
	private project: ProjectConfig | undefined;
	private title = '';
	private taskTypeId = 'task';
	private priority: ProjectPriority = 'medium';
	private reporterId: string;
	private assigneeId: string | null = null;
	private scheduledDate: string | null = null;
	private startDate: string | null = null;
	private dueDate: string | null = null;
	private endDate: string | null = null;
	private tags: string[] = [];
	private custom: Record<string, unknown> = {};
	private body = '';
	private links = '';
	private subtasks = '';
	private relations: TaskRelation[] = [];
	private relationTargetUid = '';
	private note = '';
	private noteAuthorId: string;
	private bodyDrafts: Record<string, string> = {};
	private fieldDrafts: Record<string, Record<string, unknown>> = {};

	constructor(manager: ProjectManager) {
		super(manager);
		this.reporterId = manager.globalConfig.currentUserId;
		this.noteAuthorId = manager.globalConfig.currentUserId;
		this.project = manager.projects.find((p) => p.active);
		this.taskTypeId = this.project?.taskTypes.find((t) => t.active)?.id ?? '';
		this.body = this.currentTemplate() ?? '';
		this.applyTaskTypeDefaults();
	}

	onOpen(): void {
		this.setTitle('新增项目');
		this.render();
	}

	onClose(): void {
		this.clearMarkdownEditors();
	}

	private render(): void {
		this.clearMarkdownEditors();
		const shell = buildTaskDialogShell(this.contentEl, {
			subtitle: '填写项目信息并创建到所选项目。',
		});
		const taskType = this.currentTaskType();

		// 项目选择器（Create 特有）
		const identityEl = shell.createSection('基本信息');
		new Setting(identityEl).setName('项目').addDropdown((dropdown) => {
			for (const project of this.manager.projects.filter((item) => item.active)) {
				dropdown.addOption(project.uid, `${project.code} · ${project.name}`);
			}
			if (this.project) dropdown.setValue(this.project.uid);
			dropdown.onChange((uid) => {
				this.project = this.manager.projects.find((item) => item.uid === uid);
				this.taskTypeId = this.project?.taskTypes.find((type) => type.active)?.id ?? '';
				this.bodyDrafts = {};
				this.fieldDrafts = {};
				this.body = this.currentTemplate() ?? '';
				this.applyTaskTypeDefaults();
				this.render();
			});
		});
		new Setting(identityEl).setName('任务类型').addDropdown((dropdown) => {
			for (const type of this.project?.taskTypes.filter((item) => item.active) ?? []) {
				dropdown.addOption(type.id, type.name);
			}
			dropdown.setValue(this.taskTypeId).onChange((value) => {
				const nextType = this.project?.taskTypes.find((type) => type.id === value);
				const template = nextType?.template ?? null;
				const switched = switchTaskTypeDraft(this.bodyDrafts, this.taskTypeId, this.body, value, template);
				const switchedFields = switchTaskTypeFieldDrafts(
					this.fieldDrafts, this.taskTypeId, this.currentFieldValues(), value, this.defaultFieldValues(nextType),
				);
				this.bodyDrafts = switched.drafts;
				this.fieldDrafts = switchedFields.drafts;
				this.taskTypeId = value;
				this.body = switched.body;
				this.applyFieldValues(switchedFields.values);
				this.render();
			});
		});

		// 共享表单字段
		const ctx: TaskFormContext = {
			manager: this.manager,
			state: this.buildFormState(),
			project: this.project,
			taskType,
			isCreate: true,
			sourcePath: this.project?.taskDirectory ?? '',
			onTitleChange: (v) => (this.title = v),
			onPriorityChange: (v) => (this.priority = v),
			onReporterChange: (v) => (this.reporterId = v),
			onAssigneeChange: (v) => (this.assigneeId = v),
			onDateChange: (field, value) => { (this as Record<string, unknown>)[field] = value; },
			onTagsChange: (tags) => (this.tags = tags),
			onCustomFieldChange: (key, value) => (this.custom[key] = value),
			onBodyChange: (v) => (this.body = v),
			onLinksChange: (v) => (this.links = v),
			onSubtasksChange: (v) => (this.subtasks = v),
			onRerender: () => this.render(),
			renderRelations: (container) => this.renderRelations(container),
			renderNotes: (container) => this.renderNotes(container),
		};
		this.renderCommonSections(shell, ctx);

		new Setting(shell.footerEl).addButton((button) =>
			button.setButtonText('创建项目').setCta().onClick(() => void this.submit()),
		);
	}

	private buildFormState(): SharedTaskFormState {
		return {
			title: this.title,
			taskTypeId: this.taskTypeId,
			priority: this.priority,
			reporterId: this.reporterId,
			assigneeId: this.assigneeId,
			scheduledDate: this.scheduledDate,
			startDate: this.startDate,
			dueDate: this.dueDate,
			endDate: this.endDate,
			tags: this.tags,
			custom: this.custom,
			body: this.body,
			links: this.links,
			subtasks: this.subtasks,
		};
	}

	private currentTemplate(): string | null {
		const taskType = this.project?.taskTypes.find((type) => type.id === this.taskTypeId);
		return taskType ? resolveTaskTypeTemplate(taskType) : null;
	}

	private currentTaskType() {
		return this.project?.taskTypes.find((type) => type.id === this.taskTypeId);
	}

	private applyTaskTypeDefaults(): void {
		const type = this.currentTaskType();
		if (!type) return;
		this.applyFieldValues(this.defaultFieldValues(type));
	}

	private defaultFieldValues(type = this.currentTaskType()): Record<string, unknown> {
		return {
			title: taskFieldDefault<string>(type, 'title') ?? '',
			priority: taskFieldDefault<ProjectPriority>(type, 'priority') ?? taskFieldOptions(type, 'priority')[0]?.id ?? 'medium',
			reporterId: taskFieldDefault<string | null>(type, 'reporter') || this.manager.globalConfig.currentUserId,
			assigneeId: taskFieldDefault<string | null>(type, 'assignee') ?? null,
			scheduledDate: taskFieldDefault<string | null>(type, 'scheduledDate') ?? null,
			startDate: taskFieldDefault<string | null>(type, 'startDate') ?? null,
			dueDate: taskFieldDefault<string | null>(type, 'dueDate') ?? null,
			endDate: taskFieldDefault<string | null>(type, 'endDate') ?? null,
			tags: [...(taskFieldDefault<string[]>(type, 'tags') ?? [])],
			links: taskFieldDefault<string>(type, 'links') ?? '',
			subtasks: taskFieldDefault<string>(type, 'subtasks') ?? '',
			note: taskFieldDefault<string>(type, 'notes') ?? '',
			noteAuthorId: this.manager.globalConfig.currentUserId,
		};
	}

	private currentFieldValues(): Record<string, unknown> {
		return {
			title: this.title, priority: this.priority, reporterId: this.reporterId,
			assigneeId: this.assigneeId, scheduledDate: this.scheduledDate, startDate: this.startDate,
			dueDate: this.dueDate, endDate: this.endDate, tags: [...this.tags],
			links: this.links, subtasks: this.subtasks, note: this.note, noteAuthorId: this.noteAuthorId,
		};
	}

	private applyFieldValues(values: Record<string, unknown>): void {
		this.title = typeof values.title === 'string' ? values.title : '';
		const priorityOptions = taskFieldOptions(this.currentTaskType(), 'priority');
		this.priority = typeof values.priority === 'string' && priorityOptions.some((o) => o.id === values.priority)
			? values.priority : priorityOptions[0]?.id ?? 'medium';
		this.reporterId = typeof values.reporterId === 'string' && values.reporterId ? values.reporterId : this.manager.globalConfig.currentUserId;
		this.assigneeId = typeof values.assigneeId === 'string' && values.assigneeId ? values.assigneeId : null;
		this.scheduledDate = typeof values.scheduledDate === 'string' && values.scheduledDate ? values.scheduledDate : null;
		this.startDate = typeof values.startDate === 'string' && values.startDate ? values.startDate : null;
		this.dueDate = typeof values.dueDate === 'string' && values.dueDate ? values.dueDate : null;
		this.endDate = typeof values.endDate === 'string' && values.endDate ? values.endDate : null;
		this.tags = Array.isArray(values.tags) ? values.tags.filter((v): v is string => typeof v === 'string') : [];
		this.links = typeof values.links === 'string' ? values.links : '';
		this.subtasks = typeof values.subtasks === 'string' ? values.subtasks : '';
		this.note = typeof values.note === 'string' ? values.note : '';
		this.noteAuthorId = typeof values.noteAuthorId === 'string' && values.noteAuthorId ? values.noteAuthorId : this.manager.globalConfig.currentUserId;
	}

	private renderRelations(container: HTMLElement): void {
		for (const relation of this.relations) {
			new Setting(container)
				.setName(`关联 · ${relation.targetKey}`)
				.setDesc(relation.targetTitle)
				.addExtraButton((button) => button.setIcon('trash').setTooltip('删除关系').onClick(() => {
					this.relations = this.relations.filter((item) => item.id !== relation.id);
					this.render();
				}));
		}
		const candidates = this.manager.index.validTasks().filter((task) =>
			!this.relations.some((relation) => relation.targetUid === task.document.metadata.uid),
		);
		new Setting(container)
			.setName('添加关联项目')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '选择项目');
				for (const task of candidates) dropdown.addOption(task.document.metadata.uid, `${task.document.metadata.key} · ${task.document.metadata.title}`);
				dropdown.setValue(this.relationTargetUid).onChange((value) => (this.relationTargetUid = value));
			})
			.addButton((button) => button.setButtonText('添加').onClick(() => {
				const target = this.manager.index.get(this.relationTargetUid);
				if (!target) return;
				this.relations.push({
					id: createUuid(), type: 'related', targetUid: target.document.metadata.uid,
					targetKey: target.document.metadata.key, targetTitle: target.document.metadata.title,
				});
				this.relationTargetUid = '';
				this.render();
			}));
	}

	private renderNotes(container: HTMLElement): void {
		new Setting(container)
			.setName('首条备注')
			.setDesc('创建项目时作为第一条结构化备注保存。')
			.addDropdown((dropdown) => {
				for (const person of this.manager.globalConfig.people.filter((item) => item.active)) dropdown.addOption(person.id, person.name);
				dropdown.setValue(this.noteAuthorId).onChange((value) => (this.noteAuthorId = value));
			});
		this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container,
			value: this.note,
			onChange: (value) => (this.note = value),
			sourcePath: this.project?.taskDirectory ?? '',
			placeholder: '记录上下文、评审结论或后续动作。',
		}));
	}

	private async submit(): Promise<void> {
		if (!this.project || !this.title.trim() || !this.taskTypeId) {
			new Notice('请选择项目、任务类型并填写标题。');
			return;
		}
		const configuredIssues = validateConfiguredTaskFields(this.currentTaskType(), {
			title: this.title, priority: this.priority, reporter: this.reporterId,
			assignee: this.assigneeId, scheduledDate: this.scheduledDate, startDate: this.startDate,
			dueDate: this.dueDate, endDate: this.endDate, tags: this.tags, body: this.body,
			links: this.links, subtasks: this.subtasks, relations: this.relations,
			notes: this.note, customFields: this.custom,
		});
		if (configuredIssues.length > 0) {
			new Notice(configuredIssues.join('\n'));
			return;
		}
		try {
			const path = await this.manager.createTask({
				project: this.project, title: this.title, taskTypeId: this.taskTypeId, priority: this.priority,
				reporterId: this.reporterId, assigneeId: this.assigneeId, scheduledDate: this.scheduledDate,
				startDate: this.startDate, dueDate: this.dueDate, endDate: this.endDate,
				tags: this.tags, custom: this.custom, body: this.body, links: this.links, subtasks: this.subtasks,
				relations: this.relations, note: this.note, noteAuthorId: this.noteAuthorId,
			});
			this.close();
			await this.manager.openTask(path);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}