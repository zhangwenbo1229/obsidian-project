import { Modal, Notice, Setting } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import { rootTagPath } from '../services/tag-group-service';
import { TagGroupModal } from './tag-group-modal';

export class TagGroupAssignmentModal extends Modal {
	private groupId: string;

	constructor(private readonly manager: ProjectManager, private readonly tagPath: string) {
		super(manager.app);
		this.groupId = manager.tagGroupAssignments[rootTagPath(tagPath)] ?? '';
	}

	onOpen(): void {
		this.setTitle(`设置标签分组：${rootTagPath(this.tagPath)}`);
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		new Setting(this.contentEl).setName('所属分组').addDropdown((dropdown) => {
			dropdown.addOption('', '未分组');
			for (const group of [...this.manager.tagGroups].sort((left, right) => left.order - right.order)) {
				dropdown.addOption(group.id, group.name);
			}
			dropdown.setValue(this.groupId).onChange((value) => (this.groupId = value));
		});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('新建标签分组').onClick(() => new TagGroupModal(this.manager, undefined, () => this.render()).open()))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private async save(): Promise<void> {
		try {
			await this.manager.assignTagGroup(this.tagPath, this.groupId || null);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
