import { Modal, Notice, Setting } from 'obsidian';
import { availableTransitions, transitionTask } from '../domain/workflow';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { fromDateTimeLocalInput, localDateTime, toDateTimeLocalInput } from '../utils/dates';
import { createUuid } from '../utils/ids';
import { MigrationModal } from './migration-modal';
import type { TaskPriority } from '../domain/types';
import { buildTaskDialogShell } from './task-dialog';
import { resolveTaskTypeTemplate, switchTaskTypeDraft } from '../services/task-service';
import { renderMarkdownEditor, type MarkdownEditorHandle } from './markdown-editor';
import { taskFieldEnabled } from '../settings/task-field-configuration';
import { validateConfiguredTaskFields } from '../services/task-field-validation';
import { renderGroupedTagPicker } from './grouped-tag-picker';

function displayValue(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number'
		? String(value)
		: '';
}

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
		this.setTitle(`${this.document.metadata.key} · 编辑任务`);
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
		const identityEl = shell.createSection('基本信息');
		const planningEl = shell.createSection('计划与人员');
		const customEl = taskFieldEnabled(taskType, 'customFields') ? shell.createSection('自定义字段') : null;
		customEl?.addClass('op-task-custom-fields');
		const bodyEl = taskFieldEnabled(taskType, 'body') ? shell.createSection('任务正文', 'op-task-dialog-section-wide') : null;
		const linksEditorEl = taskFieldEnabled(taskType, 'links') ? shell.createSection('链接', 'op-task-dialog-section-wide') : null;
		const subtasksEl = taskFieldEnabled(taskType, 'subtasks') ? shell.createSection('子任务', 'op-task-dialog-section-wide') : null;
		const workflowEl = shell.createSection('工作流', 'op-task-dialog-section-wide');
		const relationsEl = taskFieldEnabled(taskType, 'relations') ? shell.createSection('任务关系', 'op-task-dialog-section-wide') : null;
		const notesEl = taskFieldEnabled(taskType, 'notes') ? shell.createSection('备注', 'op-task-dialog-section-wide') : null;

		if (taskFieldEnabled(taskType, 'title')) new Setting(identityEl).setName('标题').addText((text) =>
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
		if (taskFieldEnabled(taskType, 'priority')) new Setting(identityEl).setName('优先级').addDropdown((dropdown) => dropdown
			.addOption('high', '高')
			.addOption('medium', '中')
			.addOption('low', '低')
			.setValue(this.document.metadata.priority ?? 'medium')
			.onChange((value) => (this.document.metadata.priority = value as TaskPriority)));
		if (taskFieldEnabled(taskType, 'reporter')) new Setting(planningEl).setName('提报人').addDropdown((dropdown) => {
			for (const person of this.manager.globalConfig.people) dropdown.addOption(person.id, person.name);
			dropdown.setValue(this.document.metadata.reporterId).onChange((value) => (this.document.metadata.reporterId = value));
		});
		if (taskFieldEnabled(taskType, 'assignee')) new Setting(planningEl).setName('经办人').addDropdown((dropdown) => {
			dropdown.addOption('', '未分配');
			for (const person of this.manager.globalConfig.people) dropdown.addOption(person.id, person.name);
			dropdown.setValue(this.document.metadata.assigneeId ?? '').onChange((value) => (this.document.metadata.assigneeId = value || null));
		});
		if (taskFieldEnabled(taskType, 'dueDate')) new Setting(planningEl).setName('计划完成日期').addText((text) => {
			text.inputEl.type = 'datetime-local';
			text.setValue(toDateTimeLocalInput(this.document.metadata.dueDate)).onChange((value) => (this.document.metadata.dueDate = fromDateTimeLocalInput(value)));
		});
		if (taskFieldEnabled(taskType, 'startDate')) new Setting(planningEl).setName('开始日期').addText((text) => {
			text.inputEl.type = 'datetime-local';
			text.setValue(toDateTimeLocalInput(this.document.metadata.startDate)).onChange((value) => (this.document.metadata.startDate = fromDateTimeLocalInput(value)));
		});
		if (taskFieldEnabled(taskType, 'completedAt')) new Setting(planningEl).setName('完成日期').addText((text) => {
			text.inputEl.type = 'datetime-local';
			text.setValue(toDateTimeLocalInput(this.document.metadata.completedAt)).onChange((value) => (this.document.metadata.completedAt = fromDateTimeLocalInput(value)));
		});
		if (taskFieldEnabled(taskType, 'terminatedAt')) new Setting(planningEl).setName('终止日期').addText((text) => {
			text.inputEl.type = 'datetime-local';
			text.setValue(toDateTimeLocalInput(this.document.metadata.terminatedAt)).onChange((value) => (this.document.metadata.terminatedAt = fromDateTimeLocalInput(value)));
		});
		if (taskFieldEnabled(taskType, 'tags')) renderGroupedTagPicker(
			planningEl,
			this.manager,
			this.document.metadata.tags,
			(tags) => (this.document.metadata.tags = tags),
		);
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
			.setDesc('结构化任务关系在下方单独管理；这里保留普通 wikilink 和 URL。')
			.addTextArea((area) => {
				area.inputEl.addClass('op-markdown-editor', 'is-compact');
				area.setValue(this.document.unknownLinks.join('\n')).onChange((value) => {
					this.document.unknownLinks = value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
				});
			});
		if (subtasksEl) this.markdownEditors.push(renderMarkdownEditor({
			app: this.manager.app,
			container: subtasksEl,
			value: this.document.subtasks ?? '',
			onChange: (value) => (this.document.subtasks = value),
			sourcePath: this.entry.path,
			placeholder: '- [ ] 使用 Markdown 记录子任务',
		}));
		for (const field of customEl ? this.entry.project.customFields.filter((item) => item.active && (!item.taskTypeIds || item.taskTypeIds.includes(this.document.metadata.taskTypeId))) : []) {
			const setting = new Setting(customEl!).setName(field.name);
			if (field.type === 'boolean') {
				setting.addToggle((toggle) => toggle.setValue(Boolean(this.document.metadata.custom[field.key])).onChange((value) => (this.document.metadata.custom[field.key] = value)));
			} else if (field.type === 'single-select') {
				setting.addDropdown((dropdown) => {
					for (const option of field.options ?? []) dropdown.addOption(option.id, option.name);
				dropdown.setValue(displayValue(this.document.metadata.custom[field.key])).onChange((value) => (this.document.metadata.custom[field.key] = value));
				});
			} else if (field.type === 'multi-select') {
				setting.addText((text) => text.setPlaceholder('使用逗号分隔选项 ID').setValue(Array.isArray(this.document.metadata.custom[field.key]) ? (this.document.metadata.custom[field.key] as unknown[]).join(',') : '').onChange((value) => (this.document.metadata.custom[field.key] = value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean))));
			} else if (field.type === 'user') {
				setting.addDropdown((dropdown) => {
					dropdown.addOption('', '未选择');
					for (const person of this.manager.globalConfig.people) dropdown.addOption(person.id, person.name);
					dropdown.setValue(displayValue(this.document.metadata.custom[field.key])).onChange((value) => (this.document.metadata.custom[field.key] = value || null));
				});
			} else if (field.type === 'task-reference') {
				setting.addDropdown((dropdown) => {
					dropdown.addOption('', '未选择');
					for (const task of this.manager.index.validTasks()) dropdown.addOption(task.document.metadata.uid, `${task.document.metadata.key} · ${task.document.metadata.title}`);
					dropdown.setValue(displayValue(this.document.metadata.custom[field.key])).onChange((value) => (this.document.metadata.custom[field.key] = value || null));
				});
			} else if (field.type === 'date') {
				setting.addText((text) => {
					text.inputEl.type = 'date';
					text.setValue(displayValue(this.document.metadata.custom[field.key])).onChange((value) => (this.document.metadata.custom[field.key] = value || null));
				});
			} else if (field.type === 'datetime') {
				setting.addText((text) => {
					text.inputEl.type = 'datetime-local';
					text.setValue(toDateTimeLocalInput(displayValue(this.document.metadata.custom[field.key]))).onChange((value) => (this.document.metadata.custom[field.key] = fromDateTimeLocalInput(value)));
				});
			} else if (field.type === 'multiline-text') {
				setting.addTextArea((area) => area.setValue(displayValue(this.document.metadata.custom[field.key])).onChange((value) => (this.document.metadata.custom[field.key] = value)));
			} else {
				setting.addText((text) => text.setValue(displayValue(this.document.metadata.custom[field.key])).onChange((value) => {
					this.document.metadata.custom[field.key] = field.type === 'number' ? Number(value) : value;
				}));
			}
		}
		if (customEl && customEl.childElementCount === 0) {
			customEl.createDiv({ cls: 'op-task-dialog-empty', text: '当前项目没有启用自定义字段。' });
		}
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
			.setName('添加关联任务')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '选择任务');
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
			.addButton((button) => button.setButtonText('在 Markdown 中打开').onClick(() => void this.manager.openTask(this.entry.path)))
			.addButton((button) => button.setButtonText('迁移项目').onClick(() => new MigrationModal(this.manager, this.entry).open()))
			.addButton((button) => button.setWarning().setButtonText(this.deleteArmed ? '再次选择确认删除' : '删除任务').onClick(() => {
				if (!this.deleteArmed) { this.deleteArmed = true; this.render(); return; }
				void this.deleteTask();
			}))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
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
			startDate: this.document.metadata.startDate,
			dueDate: this.document.metadata.dueDate,
			completedAt: this.document.metadata.completedAt,
			terminatedAt: this.document.metadata.terminatedAt,
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
