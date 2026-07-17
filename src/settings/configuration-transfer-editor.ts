import { Notice, Setting, setIcon } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import { parseConfigurationImport, serializeConfigurationExport, type ParsedConfigurationImport } from './configuration-transfer';

export class ConfigurationTransferEditor {
	private includeSecrets = false;
	private pending: ParsedConfigurationImport | null = null;
	private root: HTMLElement | null = null;

	constructor(private readonly manager: ProjectManager) {}

	mount(container: HTMLElement): void {
		this.root = container;
		this.render();
	}

	private render(): void {
		if (!this.root) return;
		this.root.empty();
		new Setting(this.root)
			.setName('导出配置')
			.setDesc('导出项目、模板、标签、筛选器、视图显示和个人仪表盘配置。天气密钥默认排除。')
			.addToggle((toggle) => toggle.setTooltip('包含天气 API 密钥').setValue(this.includeSecrets).onChange((value) => {
				this.includeSecrets = value;
			}))
			.addButton((button) => button.setButtonText('导出 JSON').setCta().onClick(() => this.download()));

		const importSetting = new Setting(this.root)
			.setName('导入配置')
			.setDesc('先解析并验证文件，确认摘要后才替换当前配置。任务 Markdown 文件不会被导入或删除。');
		const input = importSetting.controlEl.createEl('input', { type: 'file', attr: { accept: 'application/json,.json' } });
		input.addClass('op-configuration-file-input');
		input.addEventListener('change', () => void this.loadFile(input.files?.[0]));

		if (!this.pending) return;
		const preview = this.root.createDiv({ cls: 'op-configuration-import-preview' });
		const heading = preview.createDiv({ cls: 'op-configuration-import-heading' });
		const icon = heading.createSpan();
		setIcon(icon, 'file-check-2');
		heading.createEl('strong', { text: '配置验证通过' });
		const summary = this.pending.summary;
		const metrics = preview.createDiv({ cls: 'op-configuration-import-summary' });
		for (const [label, value] of [
			['项目', summary.projects], ['任务模板', summary.templates], ['筛选器', summary.savedFilters],
			['仪表盘卡片', summary.dashboardCards], ['标签分组', summary.tagGroups],
		] as const) {
			const item = metrics.createDiv();
			item.createEl('strong', { text: String(value) });
			item.createSpan({ text: label });
		}
		new Setting(preview)
			.setName('替换当前配置')
			.setDesc('现有配置会在写入验证失败时自动恢复。该操作不会修改任务文件。')
			.addButton((button) => button.setButtonText('取消').onClick(() => { this.pending = null; this.render(); }))
			.addButton((button) => button.setButtonText('确认导入').setWarning().onClick(() => void this.confirmImport()));
	}

	private download(): void {
		const content = serializeConfigurationExport(this.manager.configurationSnapshot(), new Date(), { includeSecrets: this.includeSecrets });
		const blob = new Blob([content], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = this.root!.createEl('a');
		anchor.href = url;
		anchor.download = `obsidian-project-config-${new Date().toISOString().slice(0, 10)}.json`;
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
		new Notice('配置已导出。');
	}

	private async loadFile(file: File | undefined): Promise<void> {
		if (!file) return;
		try {
			this.pending = parseConfigurationImport(await file.text());
			this.render();
		} catch (error) {
			this.pending = null;
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}

	private async confirmImport(): Promise<void> {
		if (!this.pending) return;
		try {
			await this.manager.replaceConfiguration(this.pending.configuration);
			this.pending = null;
			new Notice('配置已导入并验证。');
			this.render();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
