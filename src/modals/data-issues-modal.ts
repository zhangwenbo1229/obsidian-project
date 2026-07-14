import { Modal, Notice, Setting } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';

export class DataIssuesModal extends Modal {
	constructor(private readonly manager: ProjectManager) {
		super(manager.app);
	}

	onOpen(): void {
		this.setTitle(`数据问题（${this.manager.dataIssues.length}）`);
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		for (const migration of this.manager.pendingMigrations) {
			const completed = migration.items.filter((item) => item.completed).length;
			new Setting(this.contentEl)
				.setName(`未完成迁移 · ${migration.type}`)
				.setDesc(`${migration.id} · ${completed}/${migration.items.length} 个文件已完成`)
				.addButton((button) => button.setButtonText('继续迁移').setCta().onClick(() => void this.resume(migration.id)));
		}
		if (this.manager.dataIssues.length === 0 && this.manager.pendingMigrations.length === 0) {
			this.contentEl.createEl('p', { text: '没有发现数据问题。' });
			return;
		}
		for (const item of this.manager.dataIssues) {
			new Setting(this.contentEl)
				.setName(item.issue.message)
				.setDesc(item.path)
				.addButton((button) => button.setButtonText('打开文件').onClick(() => void this.manager.openTask(item.path)))
				.addButton((button) => button.setButtonText('尝试修复').onClick(() => void this.repair(item.path, item.issue.code)));
		}
	}

	private async resume(id: string): Promise<void> {
		try {
			await this.manager.resumeMigration(id);
			this.render();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async repair(path: string, code: string): Promise<void> {
		try {
			await this.manager.repairIssue(path, code);
			this.render();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
