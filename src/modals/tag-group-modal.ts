import { Modal, Notice, Setting } from 'obsidian';
import type { TagGroup } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { createUuid } from '../utils/ids';

export class TagGroupModal extends Modal {
	private name: string;

	constructor(
		private readonly manager: ProjectManager,
		private readonly group?: TagGroup,
		private readonly onChanged?: () => void,
	) {
		super(manager.app);
		this.name = group?.name ?? '';
	}

	onOpen(): void {
		this.setTitle(this.group ? '编辑标签分组' : '新建标签分组');
		new Setting(this.contentEl).setName('分组名称').addText((text) => text
			.setPlaceholder('例如：交付')
			.setValue(this.name)
			.onChange((value) => (this.name = value)));
		const actions = new Setting(this.contentEl);
		if (this.group) actions.addButton((button) => button
			.setButtonText('删除分组')
			.setWarning()
			.onClick(() => void this.remove()));
		actions.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private async save(): Promise<void> {
		try {
			await this.manager.saveTagGroup({
				id: this.group?.id ?? createUuid(),
				name: this.name,
				order: this.group?.order ?? this.manager.tagGroups.length,
			});
			this.close();
			this.onChanged?.();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async remove(): Promise<void> {
		if (!this.group) return;
		await this.manager.deleteTagGroup(this.group.id);
		this.close();
		this.onChanged?.();
	}
}
