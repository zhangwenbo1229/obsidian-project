import { Modal, Notice, Setting } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';

export class PropertyStyleModal extends Modal {
	private icon: string;
	private color: string;
	private groupId: string;

	constructor(private readonly manager: ProjectManager, private readonly propertyKey: string) {
		super(manager.app);
		const style = manager.nativeSidebarSettings.propertyStyles[propertyKey];
		this.icon = style?.icon ?? '';
		this.color = style?.color ?? '#626f86';
		this.groupId = style?.groupId ?? '';
	}

	onOpen(): void {
		this.setTitle(`编辑属性：${this.propertyKey}`);
		new Setting(this.contentEl).setName('图标').addText((text) => text.setValue(this.icon).onChange((icon) => (this.icon = icon)));
		new Setting(this.contentEl).setName('颜色').addColorPicker((picker) => picker.setValue(this.color).onChange((color) => (this.color = color)));
		new Setting(this.contentEl).setName('属性分组').addDropdown((dropdown) => {
			dropdown.addOption('', '未分组');
			for (const group of this.manager.nativeSidebarSettings.propertyGroups) dropdown.addOption(group.id, group.name);
			dropdown.setValue(this.groupId).onChange((groupId) => (this.groupId = groupId));
		});
		new Setting(this.contentEl).addButton((button) => button.setCta().setButtonText('保存').onClick(() => void this.save()));
	}

	private async save(): Promise<void> {
		try {
			await this.manager.savePropertyStyle(this.propertyKey, { icon: this.icon.trim() || undefined, color: this.color, groupId: this.groupId || undefined });
			this.close();
		} catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}
}
