import { Modal, Notice, Setting, setIcon } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import { TaskMarkerPickerModal } from './task-marker-picker-modal';

export class TagStyleModal extends Modal {
	private icon: string;
	private color: string;

	constructor(
		private readonly manager: ProjectManager,
		private readonly tagPath: string,
		private readonly onSaved: () => void,
	) {
		super(manager.app);
		const style = manager.tagStyles[tagPath];
		this.icon = style?.icon ?? '';
		this.color = style?.color ?? '#0c66e4';
	}

	onOpen(): void {
		this.setTitle(`编辑标签样式：${this.tagPath}`);
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		new Setting(this.contentEl)
			.setName('标签图标')
			.setDesc('选择常用 lucide 图标或 emoji；留空时不显示图标。')
			.addButton((button) => {
				button.setButtonText(this.icon ? '更换图标' : '选择图标');
				if (this.icon && /^[a-z0-9][a-z0-9-]*$/iu.test(this.icon)) setIcon(button.buttonEl, this.icon);
				button.onClick(() => new TaskMarkerPickerModal(this.app, this.icon, (icon) => {
					this.icon = icon;
					this.render();
				}).open());
			})
			.addExtraButton((button) => button
				.setIcon('x')
				.setTooltip('清除图标')
				.onClick(() => { this.icon = ''; this.render(); }));

		new Setting(this.contentEl)
			.setName('标签颜色')
			.setDesc('应用到个人仪表盘、项目视图和标签侧边栏。')
			.addColorPicker((picker) => picker.setValue(this.color).onChange((value) => (this.color = value)));

		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('恢复默认').onClick(() => {
				this.icon = '';
				this.color = '';
				void this.save();
			}))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private async save(): Promise<void> {
		try {
			await this.manager.saveTagStyle(this.tagPath, { icon: this.icon, color: this.color });
			this.close();
			this.onSaved();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
