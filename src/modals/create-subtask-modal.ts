import { Modal, Notice, Setting } from 'obsidian';
import type { EmbeddedSubtask, TaskPriority } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { createEmbeddedSubtask } from '../services/embedded-subtask-service';
import { renderGroupedTagPicker } from './grouped-tag-picker';
import { renderTaskCustomMetadataFields, taskCustomMetadataDefaults, validateTaskCustomMetadata } from './task-custom-metadata-editor';

export class CreateSubtaskModal extends Modal {
	private parent: IndexedTask | undefined;
	private title = '';
	private priority: TaskPriority = 'medium';
	private scheduledDate: string | null = null;
	private startDate: string | null = null;
	private dueDate: string | null = null;
	private endDate: string | null = null;
	private tags: string[] = [];
	private custom: Record<string, unknown>;

	constructor(
		private readonly manager: ProjectManager,
		parent?: IndexedTask,
		private readonly onCreate?: (subtask: EmbeddedSubtask) => void | Promise<void>,
		private readonly parentLabel = '当前项目',
	) {
		super(manager.app);
		this.parent = parent;
		this.custom = taskCustomMetadataDefaults(manager.taskMetadataSettings, manager.globalConfig.unifiedMetadataFields ?? []);
	}

	onOpen(): void {
		this.setTitle('新增任务');
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.addClass('op-subtask-dialog');
		if (this.onCreate) new Setting(this.contentEl).setName('项目').setDesc(this.parentLabel);
		else new Setting(this.contentEl).setName('项目').setDesc('任务会写入该项目文件的“任务”区域。').addDropdown((dropdown) => {
			dropdown.addOption('', '选择项目');
			for (const task of this.manager.index.validTasks()) dropdown.addOption(task.document.metadata.uid, `${task.document.metadata.key} · ${task.document.metadata.title}`);
			dropdown.setValue(this.parent?.document.metadata.uid ?? '').onChange((uid) => {
				this.parent = this.manager.index.get(uid);
			});
		});
		new Setting(this.contentEl).setName('标题').addText((text) => text.setValue(this.title).onChange((value) => (this.title = value)));

		// 根据 taskMetadataSettings.customFieldRefs 动态渲染内置字段
		const refKeys = this.getCustomFieldRefKeys();
		if (refKeys.has('priority')) {
			new Setting(this.contentEl).setName('优先级').addDropdown((dropdown) => dropdown
				.addOption('high', '高').addOption('medium', '中').addOption('low', '低')
				.setValue(this.priority).onChange((value) => (this.priority = value as TaskPriority)));
		}
		if (refKeys.has('scheduledDate')) this.dateSetting('计划日期', this.scheduledDate, (value) => (this.scheduledDate = value));
		if (refKeys.has('startDate')) this.dateSetting('开始日期', this.startDate, (value) => (this.startDate = value));
		if (refKeys.has('dueDate')) this.dateSetting('截止日期', this.dueDate, (value) => (this.dueDate = value));
		if (refKeys.has('endDate')) this.dateSetting('结束日期', this.endDate, (value) => (this.endDate = value));
		if (refKeys.has('tags')) {
			renderGroupedTagPicker(this.contentEl, this.manager, this.tags, (tags) => (this.tags = tags));
		}

		renderTaskCustomMetadataFields(this.contentEl, this.manager.taskMetadataSettings, this.manager.globalConfig.unifiedMetadataFields ?? [], this.custom, this.manager);
		new Setting(this.contentEl).addButton((button) => button.setButtonText('创建任务').setCta().onClick(() => void this.save()));
	}

	private getCustomFieldRefKeys(): Set<string> {
		const refs = this.manager.taskMetadataSettings.customFieldRefs ?? [];
		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		const poolById = new Map(pool.map((f) => [f.id, f]));
		const refKeys = new Set<string>();
		for (const ref of refs) {
			const unified = poolById.get(ref.unifiedMetadataFieldId);
			if (unified) refKeys.add(unified.key);
		}
		return refKeys;
	}

	private dateSetting(name: string, value: string | null, update: (value: string | null) => void): void {
		new Setting(this.contentEl).setName(name).addText((text) => {
			text.inputEl.type = 'date';
			text.setValue(value ?? '').onChange((next) => update(next || null));
		});
	}

	private async save(): Promise<void> {
		if (!this.parent && !this.onCreate) { new Notice('请选择项目。'); return; }
		try {
			validateTaskCustomMetadata(this.manager.taskMetadataSettings, this.manager.globalConfig.unifiedMetadataFields ?? [], this.custom);
			// 将 endDate 存储到 custom.endDate（EmbeddedSubtask 没有 endDate 顶层属性）
			if (this.endDate) this.custom.endDate = this.endDate;
			else delete this.custom.endDate;
			const input = {
				title: this.title, priority: this.priority, scheduledDate: this.scheduledDate,
				startDate: this.startDate, dueDate: this.dueDate, tags: this.tags, custom: this.custom,
			};
			if (this.onCreate) await this.onCreate(createEmbeddedSubtask(input));
			else await this.manager.createEmbeddedSubtask(this.parent!, input);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
