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
	private endDate: string | null;

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
			custom: taskCustomMetadataDefaults(manager.taskMetadataSettings, manager.globalConfig.unifiedMetadataFields ?? [], subtask.custom),
		};
		// endDate 存储在 custom.endDate（EmbeddedSubtask 没有 endDate 顶层属性）
		const custom = this.value.custom ?? {};
		this.endDate = typeof custom.endDate === 'string' ? custom.endDate : null;
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

		// 根据 taskMetadataSettings.customFieldRefs 动态渲染内置字段
		const refKeys = this.getCustomFieldRefKeys();
		if (refKeys.has('priority')) {
			new Setting(this.contentEl).setName('优先级').addDropdown((dropdown) => dropdown
				.addOption('high', '高').addOption('medium', '中').addOption('low', '低')
				.setValue(this.value.priority).onChange((value) => (this.value.priority = value as TaskPriority)));
		}
		if (refKeys.has('scheduledDate')) this.dateSetting('计划日期', this.value.scheduledDate, (value) => (this.value.scheduledDate = value));
		if (refKeys.has('startDate')) this.dateSetting('开始日期', this.value.startDate, (value) => (this.value.startDate = value));
		if (refKeys.has('dueDate')) this.dateSetting('截止日期', this.value.dueDate, (value) => (this.value.dueDate = value));
		if (refKeys.has('endDate')) this.dateSetting('结束日期', this.endDate, (value) => (this.endDate = value));
		if (refKeys.has('tags')) {
			renderGroupedTagPicker(this.contentEl, this.manager, this.value.tags, (tags) => (this.value.tags = tags));
		}

		renderTaskCustomMetadataFields(this.contentEl, this.manager.taskMetadataSettings, this.manager.globalConfig.unifiedMetadataFields ?? [], this.value.custom ?? (this.value.custom = {}), this.manager);
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(this.deleteArmed ? '确认删除' : '删除').setWarning().onClick(() => {
				if (!this.deleteArmed) { this.deleteArmed = true; this.render(); return; }
				void this.remove();
			}))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
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
		try {
			validateTaskCustomMetadata(this.manager.taskMetadataSettings, this.manager.globalConfig.unifiedMetadataFields ?? [], this.value.custom ?? {});
			// 将 endDate 存储到 custom.endDate（EmbeddedSubtask 没有 endDate 顶层属性）
			const custom = this.value.custom ?? (this.value.custom = {});
			if (this.endDate) custom.endDate = this.endDate;
			else delete custom.endDate;
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
