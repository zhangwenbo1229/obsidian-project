import { Modal, Notice, Setting } from 'obsidian';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { collectTaskTree } from '../domain/relations';

export class MigrationModal extends Modal {
	private targetUid = '';
	private taskTypeId = '';
	private statusId = '';

	constructor(
		private readonly manager: ProjectManager,
		private readonly entry: IndexedTask,
	) {
		super(manager.app);
		const target = manager.projects.find((project) => project.uid !== entry.project.uid && project.active);
		this.selectTarget(target?.uid ?? '');
	}

	onOpen(): void {
		this.setTitle(`迁移 ${this.entry.document.metadata.key}`);
		this.render();
	}

	private selectTarget(uid: string): void {
		this.targetUid = uid;
		const target = this.manager.projects.find((project) => project.uid === uid);
		this.taskTypeId = target?.taskTypes.find((type) => type.id === this.entry.document.metadata.taskTypeId)?.id
			?? target?.taskTypes.find((type) => type.active)?.id ?? '';
		this.statusId = target?.workflow.statuses.find((status) => status.id === this.entry.document.metadata.statusId)?.id
			?? target?.workflow.initialStatusId ?? '';
	}

	private render(): void {
		this.contentEl.empty();
		const target = this.manager.projects.find((project) => project.uid === this.targetUid);
		new Setting(this.contentEl).setName('目标项目').addDropdown((dropdown) => {
			for (const project of this.manager.projects.filter((item) => item.uid !== this.entry.project.uid && item.active)) {
				dropdown.addOption(project.uid, `${project.code} · ${project.name}`);
			}
			dropdown.setValue(this.targetUid).onChange((uid) => { this.selectTarget(uid); this.render(); });
		});
		new Setting(this.contentEl).setName('目标任务类型').addDropdown((dropdown) => {
			for (const type of target?.taskTypes.filter((item) => item.active) ?? []) dropdown.addOption(type.id, type.name);
			dropdown.setValue(this.taskTypeId).onChange((value) => (this.taskTypeId = value));
		});
		new Setting(this.contentEl).setName('目标状态').addDropdown((dropdown) => {
			for (const status of target?.workflow.statuses.filter((item) => item.active) ?? []) dropdown.addOption(status.id, status.name);
			dropdown.setValue(this.statusId).onChange((value) => (this.statusId = value));
		});
		const treeSize = collectTaskTree(this.entry.document.metadata.uid, this.manager.index).length;
		const discardedFields = Object.keys(this.entry.document.metadata.custom).filter((key) =>
			!(target?.customFields ?? []).some((field) => field.key === key && (this.entry.project.customFields ?? []).some((source) => source.key === key && source.type === field.type)),
		).length;
		new Setting(this.contentEl).setDesc(`当前任务：1 个文件；整棵任务树：${treeSize} 个文件。${discardedFields} 个不兼容自定义字段值会写入迁移报告但不带入目标项目。`)
			.addButton((button) => button.setButtonText('迁移当前任务').setCta().onClick(() => void this.submit(false)))
			.addButton((button) => button.setButtonText('迁移整棵任务树').onClick(() => void this.submit(true)));
	}

	private async submit(tree: boolean): Promise<void> {
		const target = this.manager.projects.find((project) => project.uid === this.targetUid);
		if (!target) return;
		const mappings: Record<string, string> = {};
		for (const source of this.entry.project.customFields ?? []) {
			const match = (target.customFields ?? []).find((field) => field.key === source.key && field.type === source.type);
			if (match) mappings[source.key] = match.key;
		}
		try {
			const mapping = {
				taskTypeId: this.taskTypeId,
				statusId: this.statusId,
				customFieldMappings: mappings,
			};
			if (tree) await this.manager.transferTaskTree(this.entry, target, mapping);
			else await this.manager.transferTask(this.entry, target, mapping);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
