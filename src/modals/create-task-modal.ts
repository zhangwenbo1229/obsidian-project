import { Modal, Notice, Setting } from 'obsidian';
import type { ProjectConfig, TaskFormField, TaskPriority, TaskRelation, TaskTypeDefinition } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { resolveTaskTypeTemplate, switchTaskTypeDraft, switchTaskTypeFieldDrafts } from '../services/task-service';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '../utils/dates';
import { buildTaskDialogShell } from './task-dialog';
import { renderMarkdownEditor, type MarkdownEditorHandle } from './markdown-editor';
import { createUuid } from '../utils/ids';
import { taskFieldDefault, taskFieldEnabled, taskFieldRule } from '../settings/task-field-configuration';
import { validateConfiguredTaskFields } from '../services/task-field-validation';
import { renderGroupedTagPicker } from './grouped-tag-picker';
import { applyFieldPresentation } from '../views/field-presentation';

function fieldSetting(container: HTMLElement, name: string, type: TaskTypeDefinition | undefined, field: TaskFormField): Setting {
	const setting = new Setting(container).setName(name);
	applyFieldPresentation(setting, taskFieldRule(type, field));
	return setting;
}

function displayValue(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number'
		? String(value)
		: '';
}

export class CreateTaskModal extends Modal {
	private project: ProjectConfig | undefined;
	private title = '';
	private taskTypeId = 'task';
	private priority: TaskPriority = 'medium';
	private reporterId: string;
	private assigneeId: string | null = null;
	private startDate: string | null = null;
	private dueDate: string | null = null;
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
	private markdownEditors: MarkdownEditorHandle[] = [];

	constructor(private readonly manager: ProjectManager) {
		super(manager.app);
		this.reporterId = manager.globalConfig.currentUserId;
		this.noteAuthorId = manager.globalConfig.currentUserId;
		this.project = manager.projects.find((project) => project.active);
		this.taskTypeId = this.project?.taskTypes.find((type) => type.active)?.id ?? '';
		this.body = this.currentTemplate() ?? '';
		this.applyTaskTypeDefaults();
	}

	onOpen(): void {
		this.setTitle('新增任务');
		this.render();
	}

	onClose(): void {
		this.clearMarkdownEditors();
	}

	private render(): void {
		this.clearMarkdownEditors();
		const shell = buildTaskDialogShell(this.contentEl, {
			subtitle: '填写任务信息并创建到所选项目。',
		});
		const taskType = this.currentTaskType();
		const presentation = (field: TaskFormField) => taskFieldRule(taskType, field);
		const identityEl = shell.createSection('基本信息');
		const planningEl = shell.createSection('计划与人员');
		const customEl = taskFieldEnabled(taskType, 'customFields') ? shell.createSection('自定义字段', undefined, presentation('customFields')) : null;
		customEl?.addClass('op-task-custom-fields');
		const bodyEl = taskFieldEnabled(taskType, 'body') ? shell.createSection('任务正文', 'op-task-dialog-section-wide', presentation('body')) : null;
		const linksEl = taskFieldEnabled(taskType, 'links') ? shell.createSection('链接', 'op-task-dialog-section-wide', presentation('links')) : null;
		const subtasksEl = taskFieldEnabled(taskType, 'subtasks') ? shell.createSection('子任务', 'op-task-dialog-section-wide', presentation('subtasks')) : null;
		const relationsEl = taskFieldEnabled(taskType, 'relations') ? shell.createSection('任务关系', 'op-task-dialog-section-wide', presentation('relations')) : null;
		const notesEl = taskFieldEnabled(taskType, 'notes') ? shell.createSection('备注', 'op-task-dialog-section-wide', presentation('notes')) : null;

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
					this.fieldDrafts,
					this.taskTypeId,
					this.currentFieldValues(),
					value,
					this.defaultFieldValues(nextType),
				);
				this.bodyDrafts = switched.drafts;
				this.fieldDrafts = switchedFields.drafts;
				this.taskTypeId = value;
				this.body = switched.body;
				this.applyFieldValues(switchedFields.values);
				this.render();
			});
		});
		if (taskFieldEnabled(taskType, 'priority')) fieldSetting(identityEl, '优先级', taskType, 'priority').addDropdown((dropdown) => dropdown
			.addOption('high', '高')
			.addOption('medium', '中')
			.addOption('low', '低')
			.setValue(this.priority)
			.onChange((value) => (this.priority = value as TaskPriority)));
		if (taskFieldEnabled(taskType, 'title')) fieldSetting(identityEl, '标题', taskType, 'title').addText((text) =>
			text.setValue(this.title).onChange((value) => (this.title = value)),
		);
		if (taskFieldEnabled(taskType, 'reporter')) fieldSetting(planningEl, '提报人', taskType, 'reporter').addDropdown((dropdown) => {
			for (const person of this.manager.globalConfig.people.filter((item) => item.active)) dropdown.addOption(person.id, person.name);
			dropdown.setValue(this.reporterId).onChange((value) => (this.reporterId = value));
		});
		if (taskFieldEnabled(taskType, 'assignee')) fieldSetting(planningEl, '经办人', taskType, 'assignee').addDropdown((dropdown) => {
			dropdown.addOption('', '未分配');
			for (const person of this.manager.globalConfig.people.filter((item) => item.active)) {
				dropdown.addOption(person.id, person.name);
			}
			dropdown.setValue(this.assigneeId ?? '').onChange((value) => (this.assigneeId = value || null));
		});
		if (taskFieldEnabled(taskType, 'startDate')) fieldSetting(planningEl, '开始日期', taskType, 'startDate').addText((text) => {
			text.inputEl.type = 'datetime-local';
			text.setValue(toDateTimeLocalInput(this.startDate)).onChange((value) => (this.startDate = fromDateTimeLocalInput(value)));
		});
		if (taskFieldEnabled(taskType, 'dueDate')) fieldSetting(planningEl, '计划完成日期', taskType, 'dueDate').addText((text) => {
			text.inputEl.type = 'datetime-local';
			text.setValue(toDateTimeLocalInput(this.dueDate)).onChange((value) => (this.dueDate = fromDateTimeLocalInput(value)));
		});
		if (taskFieldEnabled(taskType, 'tags')) renderGroupedTagPicker(
			planningEl,
			this.manager,
			this.tags,
			(tags) => (this.tags = tags),
			presentation('tags'),
		);
		for (const field of customEl ? this.project?.customFields.filter((item) => item.active && (!item.taskTypeIds || item.taskTypeIds.includes(this.taskTypeId))) ?? [] : []) {
			const setting = new Setting(customEl!).setName(field.name);
			applyFieldPresentation(setting, field);
			if (field.type === 'boolean') {
				setting.addToggle((toggle) => toggle.setValue(Boolean(this.custom[field.key] ?? field.default)).onChange((value) => (this.custom[field.key] = value)));
			} else if (field.type === 'single-select') {
				setting.addDropdown((dropdown) => {
					for (const option of field.options ?? []) dropdown.addOption(option.id, option.name);
				dropdown.setValue(displayValue(this.custom[field.key] ?? field.default)).onChange((value) => (this.custom[field.key] = value));
				});
			} else if (field.type === 'multi-select') {
				setting.addText((text) => text.setPlaceholder('使用逗号分隔选项 ID').setValue(Array.isArray(this.custom[field.key]) ? (this.custom[field.key] as unknown[]).join(',') : '').onChange((value) => (this.custom[field.key] = value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean))));
			} else if (field.type === 'user') {
				setting.addDropdown((dropdown) => {
					dropdown.addOption('', '未选择');
					for (const person of this.manager.globalConfig.people) dropdown.addOption(person.id, person.name);
					dropdown.setValue(displayValue(this.custom[field.key])).onChange((value) => (this.custom[field.key] = value || null));
				});
			} else if (field.type === 'task-reference') {
				setting.addDropdown((dropdown) => {
					dropdown.addOption('', '未选择');
					for (const task of this.manager.index.validTasks()) dropdown.addOption(task.document.metadata.uid, `${task.document.metadata.key} · ${task.document.metadata.title}`);
					dropdown.setValue(displayValue(this.custom[field.key])).onChange((value) => (this.custom[field.key] = value || null));
				});
			} else if (field.type === 'date') {
				setting.addText((text) => {
					text.inputEl.type = 'date';
					text.setValue(displayValue(this.custom[field.key] ?? field.default)).onChange((value) => (this.custom[field.key] = value || null));
				});
			} else if (field.type === 'datetime') {
				setting.addText((text) => {
					text.inputEl.type = 'datetime-local';
					text.setValue(toDateTimeLocalInput(displayValue(this.custom[field.key] ?? field.default))).onChange((value) => (this.custom[field.key] = fromDateTimeLocalInput(value)));
				});
			} else if (field.type === 'multiline-text') {
				setting.addTextArea((area) => area.setValue(displayValue(this.custom[field.key] ?? field.default)).onChange((value) => (this.custom[field.key] = value)));
			} else {
				setting.addText((text) => text.setValue(displayValue(this.custom[field.key] ?? field.default)).onChange((value) => {
					this.custom[field.key] = field.type === 'number' ? Number(value) : value;
				}));
			}
		}
		if (customEl && customEl.childElementCount === 0) {
			customEl.createDiv({ cls: 'op-task-dialog-empty', text: '当前项目没有启用自定义字段。' });
		}
		if (bodyEl) this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container: bodyEl,
			value: this.body,
			onChange: (value) => (this.body = value),
			sourcePath: this.project?.taskDirectory ?? '',
			placeholder: '使用 Markdown 编写任务背景、目标和验收说明。',
		}));
		if (linksEl) new Setting(linksEl)
			.setName('Markdown 链接')
			.setDesc('每行一个 wikilink、Markdown 链接或普通 URL。')
			.addTextArea((area) => {
				area.inputEl.addClass('op-markdown-editor', 'is-compact');
				area.setPlaceholder('- [[相关文档]]').setValue(this.links).onChange((value) => (this.links = value));
			});
		if (subtasksEl) this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container: subtasksEl,
			value: this.subtasks,
			onChange: (value) => (this.subtasks = value),
			sourcePath: this.project?.taskDirectory ?? '',
			placeholder: '- [ ] 使用 Markdown 记录子任务',
		}));
		if (relationsEl) this.renderRelations(relationsEl);
		if (notesEl) new Setting(notesEl)
			.setName('首条备注')
			.setDesc('创建任务时作为第一条结构化备注保存。')
			.addDropdown((dropdown) => {
				for (const person of this.manager.globalConfig.people.filter((item) => item.active)) dropdown.addOption(person.id, person.name);
				dropdown.setValue(this.noteAuthorId).onChange((value) => (this.noteAuthorId = value));
			});
		if (notesEl) this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container: notesEl,
			value: this.note,
			onChange: (value) => (this.note = value),
			sourcePath: this.project?.taskDirectory ?? '',
			placeholder: '记录上下文、评审结论或后续动作。',
		}));
		new Setting(shell.footerEl).addButton((button) =>
			button.setButtonText('创建任务').setCta().onClick(() => void this.submit()),
		);
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
			priority: taskFieldDefault<TaskPriority>(type, 'priority') ?? 'medium',
			reporterId: taskFieldDefault<string | null>(type, 'reporter') || this.manager.globalConfig.currentUserId,
			assigneeId: taskFieldDefault<string | null>(type, 'assignee') ?? null,
			startDate: taskFieldDefault<string | null>(type, 'startDate') ?? null,
			dueDate: taskFieldDefault<string | null>(type, 'dueDate') ?? null,
			tags: [...(taskFieldDefault<string[]>(type, 'tags') ?? [])],
			links: taskFieldDefault<string>(type, 'links') ?? '',
			subtasks: taskFieldDefault<string>(type, 'subtasks') ?? '',
			note: taskFieldDefault<string>(type, 'notes') ?? '',
			noteAuthorId: this.manager.globalConfig.currentUserId,
		};
	}

	private currentFieldValues(): Record<string, unknown> {
		return {
			title: this.title,
			priority: this.priority,
			reporterId: this.reporterId,
			assigneeId: this.assigneeId,
			startDate: this.startDate,
			dueDate: this.dueDate,
			tags: [...this.tags],
			links: this.links,
			subtasks: this.subtasks,
			note: this.note,
			noteAuthorId: this.noteAuthorId,
		};
	}

	private applyFieldValues(values: Record<string, unknown>): void {
		this.title = typeof values.title === 'string' ? values.title : '';
		this.priority = values.priority === 'high' || values.priority === 'low' ? values.priority : 'medium';
		this.reporterId = typeof values.reporterId === 'string' && values.reporterId ? values.reporterId : this.manager.globalConfig.currentUserId;
		this.assigneeId = typeof values.assigneeId === 'string' && values.assigneeId ? values.assigneeId : null;
		this.startDate = typeof values.startDate === 'string' && values.startDate ? values.startDate : null;
		this.dueDate = typeof values.dueDate === 'string' && values.dueDate ? values.dueDate : null;
		this.tags = Array.isArray(values.tags) ? values.tags.filter((value): value is string => typeof value === 'string') : [];
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
			.setName('添加关联任务')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '选择任务');
				for (const task of candidates) dropdown.addOption(task.document.metadata.uid, `${task.document.metadata.key} · ${task.document.metadata.title}`);
				dropdown.setValue(this.relationTargetUid).onChange((value) => (this.relationTargetUid = value));
			})
			.addButton((button) => button.setButtonText('添加').onClick(() => {
				const target = this.manager.index.get(this.relationTargetUid);
				if (!target) return;
				this.relations.push({
					id: createUuid(),
					type: 'related',
					targetUid: target.document.metadata.uid,
					targetKey: target.document.metadata.key,
					targetTitle: target.document.metadata.title,
				});
				this.relationTargetUid = '';
				this.render();
			}));
	}

	private clearMarkdownEditors(): void {
		for (const editor of this.markdownEditors) editor.unload();
		this.markdownEditors = [];
	}

	private async submit(): Promise<void> {
		if (!this.project || !this.title.trim() || !this.taskTypeId) {
			new Notice('请选择项目、任务类型并填写标题。');
			return;
		}
		const configuredIssues = validateConfiguredTaskFields(this.currentTaskType(), {
			title: this.title,
			priority: this.priority,
			reporter: this.reporterId,
			assignee: this.assigneeId,
			startDate: this.startDate,
			dueDate: this.dueDate,
			tags: this.tags,
			body: this.body,
			links: this.links,
			subtasks: this.subtasks,
			relations: this.relations,
			notes: this.note,
			customFields: this.custom,
		});
		if (configuredIssues.length > 0) {
			new Notice(configuredIssues.join('\n'));
			return;
		}
		try {
			const path = await this.manager.createTask({
				project: this.project, title: this.title, taskTypeId: this.taskTypeId, priority: this.priority,
				reporterId: this.reporterId, assigneeId: this.assigneeId, startDate: this.startDate, dueDate: this.dueDate,
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
