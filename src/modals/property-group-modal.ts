import { Modal, Notice, Setting } from 'obsidian';
import type { PropertyGroupPresentation } from '../settings/native-sidebar-settings';
import type { ProjectManager } from '../services/project-manager';
import { createUuid } from '../utils/ids';

export class PropertyGroupModal extends Modal {
	private value: PropertyGroupPresentation;

	constructor(private readonly manager: ProjectManager, group?: PropertyGroupPresentation) {
		super(manager.app);
		this.value = structuredClone(group ?? { id: createUuid(), name: '', order: manager.nativeSidebarSettings.propertyGroups.length, color: '#626f86', icon: 'list' });
	}

	onOpen(): void {
		this.setTitle(this.manager.nativeSidebarSettings.propertyGroups.some((group) => group.id === this.value.id) ? '编辑属性分组' : '新建属性分组');
		new Setting(this.contentEl).setName('分组名称').addText((text) => text.setValue(this.value.name).onChange((name) => (this.value.name = name)));
		new Setting(this.contentEl).setName('图标').addText((text) => text.setValue(this.value.icon ?? '').onChange((icon) => (this.value.icon = icon.trim() || undefined)));
		new Setting(this.contentEl).setName('颜色').addColorPicker((picker) => picker.setValue(this.value.color ?? '#626f86').onChange((color) => (this.value.color = color)));
		const actions = new Setting(this.contentEl);
		if (this.manager.nativeSidebarSettings.propertyGroups.some((group) => group.id === this.value.id)) actions.addButton((button) => button.setWarning().setButtonText('删除').onClick(() => void this.remove()));
		actions.addButton((button) => button.setCta().setButtonText('保存').onClick(() => void this.save()));
	}

	private async save(): Promise<void> {
		try {
			if (!this.value.name.trim()) throw new Error('属性分组名称不能为空。');
			await this.manager.savePropertyGroup({ ...this.value, name: this.value.name.trim() });
			this.close();
		} catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}

	private async remove(): Promise<void> {
		await this.manager.deletePropertyGroup(this.value.id);
		this.close();
	}
}
