import { Modal, Notice, Setting } from 'obsidian';
import type { EmbeddedSubtask, TaskPriority } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { updateEmbeddedSubtask } from '../services/embedded-subtask-service';
import { renderGroupedTagPicker } from './grouped-tag-picker';
import { renderTaskCustomMetadataFields, taskCustomMetadataDefaults, validateTaskCustomMetadata } from './task-custom-metadata-editor';

export interface EditSubtaskModalCallbacks {
	parentLabel?: string;
	onSave?(subtask: EmbeddedSubtask): void | Promise<void>;
	onDelete?(id: string): void | Promise<void>;
}

export class EditSubtaskModal extends Modal {
	private value: EmbeddedSubtask;
	private readonly original: EmbeddedSubtask;
	private deleteArmed = false;

	constructor(
		private readonly manager: ProjectManager,
		private readonly parent: IndexedTask | null,
		subtask: EmbeddedSubtask,
		private readonly callbacks: EditSubtaskModalCallbacks = {},
	) {
		super(manager.app);
		this.original = structuredClone(subtask);
		this.value = {
			...structuredClone(subtask),
			custom: taskCustomMetadataDefaults(manager.taskMetadataSettings, subtask.custom),
		};
	}

	onOpen(): void { this.setTitle('编辑任务'); this.render(); }

	private render(): void {
		this.contentEl.empty();
		this.contentEl.addClass('op-subtask-dialog');
		new Setting(this.contentEl).setName('项目').setDesc(
			this.callbacks.parentLabel ?? (this.parent ? `${this.parent.document.metadata.key} · ${this.parent.document.metadata.title}` : '当前项目'),
		);
		new Setting(this.contentEl).setName('已完成').addToggle((toggle) => toggle.setValue(this.value.completed).onChange((value) => (this.value.completed = value)));
		new Setting(this.contentEl).setName('标题').addText((text) => text.setValue(this.value.title).onChange((value) => (this.value.title = value)));
		new Setting(this.contentEl).setName('优先级').addDropdown((dropdown) => dropdown
			.addOption('high', '高').addOption('medium', '中').addOption('low', '低')
			.setValue(this.value.priority).onChange((value) => (this.value.priority = value as TaskPriority)));
		this.dateSetting('计划日期', this.value.scheduledDate, (value) => (this.value.scheduledDate = value));
		this.dateSetting('开始日期', this.value.startDate, (value) => (this.value.startDate = value));
		this.dateSetting('截止日期', this.value.dueDate, (value) => (this.value.dueDate = value));
		renderGroupedTagPicker(this.contentEl, this.manager, this.value.tags, (tags) => (this.value.tags = tags));
		renderTaskCustomMetadataFields(this.contentEl, this.manager.taskMetadataSettings, this.value.custom ?? (this.value.custom = {}));
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(this.deleteArmed ? '确认删除' : '删除').setWarning().onClick(() => {
				if (!this.deleteArmed) { this.deleteArmed = true; this.render(); return; }
				void this.remove();
			}))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private dateSetting(name: string, value: string | null, update: (value: string | null) => void): void {
		new Setting(this.contentEl).setName(name).addText((text) => {
			text.inputEl.type = 'date';
			text.setValue(value ?? '').onChange((next) => update(next || null));
		});
	}

	private async save(): Promise<void> {
		try {
			validateTaskCustomMetadata(this.manager.taskMetadataSettings, this.value.custom ?? {});
			const next = updateEmbeddedSubtask(this.original, this.value);
			if (this.callbacks.onSave) await this.callbacks.onSave(next);
			else await this.manager.updateEmbeddedSubtask(this.parent!, next);
			this.close();
		}
		catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}

	private async remove(): Promise<void> {
		try {
			if (this.callbacks.onDelete) await this.callbacks.onDelete(this.value.id);
			else await this.manager.deleteEmbeddedSubtask(this.parent!, this.value.id);
			this.close();
		}
		catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}
}
