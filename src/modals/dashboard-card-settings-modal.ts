import { Component, Modal, Notice, Setting } from 'obsidian';
import type {
	DashboardCardKind,
	DashboardMetric,
	DashboardModuleConfig,
	PersonalDashboardCardLayout,
	TaskDisplayField,
} from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { defaultDashboardCardBackground, updateDashboardCard } from '../views/dashboard-layout';
import { SortableDisplayFields } from '../settings/sortable-display-fields';
import { DASHBOARD_MODULE_CATALOG, isDashboardModuleKind, normalizeDashboardModuleConfig } from '../views/dashboard-modules/config';
import { getDashboardModuleDefinition } from '../views/dashboard-modules/registry';

const CARD_KIND_LABELS = Object.fromEntries([
	...Object.entries({
	number: '数字',
	percentage: '百分比',
	'task-list': '任务列表',
	}),
	...DASHBOARD_MODULE_CATALOG.map((item) => [item.kind, item.label]),
]) as Record<DashboardCardKind, string>;

const METRIC_LABELS: Record<DashboardMetric, string> = {
	total: '任务总数',
	completed: '已完成',
	incomplete: '未完成',
	terminated: '已终止',
	overdue: '已逾期',
	'completion-rate': '完成率',
	'overdue-rate': '逾期率',
};

export class DashboardCardSettingsModal extends Modal {
	private readonly previewComponent = new Component();
	private title: string;
	private numberColor: string;
	private backgroundColor: string;
	private kind: DashboardCardKind;
	private metric: DashboardMetric;
	private filterId: string | null;
	private displayFields: TaskDisplayField[];
	private taskListDirection: 'horizontal' | 'vertical';
	private moduleConfig: DashboardModuleConfig | undefined;
	private percentageDataMode: 'task' | 'manual';
	private percentageCurrent: number;
	private percentageTarget: number;
	private percentageDisplay: 'number' | 'progress';

	constructor(
		private readonly manager: ProjectManager,
		private readonly card: PersonalDashboardCardLayout,
		private readonly defaultTitle: string,
		private readonly onSaved: () => void,
	) {
		super(manager.app);
		this.title = card.title ?? defaultTitle;
		this.numberColor = card.numberColor ?? '#0c66e4';
		this.backgroundColor = card.backgroundColor ?? defaultDashboardCardBackground(card.metric, card.kind);
		this.kind = card.kind;
		this.metric = card.metric;
		this.filterId = card.filterId;
		this.displayFields = [...card.displayFields];
		this.taskListDirection = card.taskListDirection ?? 'horizontal';
		this.moduleConfig = isDashboardModuleKind(card.kind)
			? normalizeDashboardModuleConfig(card.kind, card.moduleConfig)
			: undefined;
		this.percentageDataMode = card.percentageDataMode ?? 'task';
		this.percentageCurrent = card.percentageCurrent ?? 0;
		this.percentageTarget = card.percentageTarget ?? 100;
		this.percentageDisplay = card.percentageDisplay ?? 'number';
	}

	onOpen(): void {
		this.previewComponent.load();
		this.setTitle('卡片设置');
		this.renderContent();
	}

	onClose(): void {
		this.previewComponent.unload();
	}

	private renderContent(): void {
		this.contentEl.empty();
		new Setting(this.contentEl)
			.setName('卡片名称')
			.setDesc('留空将恢复默认名称。')
			.addText((text) => text.setValue(this.title).onChange((value) => (this.title = value)));

		new Setting(this.contentEl)
			.setName('卡片类型')
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(CARD_KIND_LABELS)) dropdown.addOption(value, label);
					dropdown.setValue(this.kind).onChange((value) => {
						this.kind = value as DashboardCardKind;
						this.metric = this.kind === 'percentage' ? 'completion-rate' : 'total';
						this.backgroundColor = defaultDashboardCardBackground(this.metric, this.kind);
						this.moduleConfig = isDashboardModuleKind(this.kind)
							? normalizeDashboardModuleConfig(this.kind, null)
							: undefined;
						this.renderContent();
					});
			});
		this.renderBackgroundSetting();
		const definition = getDashboardModuleDefinition(this.kind);
		if (definition && this.moduleConfig) {
			definition.renderSettings({
				container: this.contentEl,
				config: this.moduleConfig,
				manager: this.manager,
				component: this.previewComponent,
				update: (config) => (this.moduleConfig = config),
			});
			this.renderActions();
			return;
		}

		if (this.kind === 'percentage') this.renderPercentageSettings();
		if (this.kind !== 'percentage' || this.percentageDataMode === 'task') {
			new Setting(this.contentEl)
				.setName('数据源')
				.setDesc('使用全部任务，或绑定一个已保存的项目筛选器。')
				.addDropdown((dropdown) => {
					dropdown.addOption('', '全部任务');
					for (const filter of this.manager.savedProjectFilters) dropdown.addOption(filter.id, filter.name);
					dropdown.setValue(this.filterId ?? '').onChange((value) => (this.filterId = value || null));
				});
		}

		if (this.kind !== 'percentage' || this.percentageDataMode === 'task') this.renderMetricSetting();
		if (this.kind !== 'task-list') {
			new Setting(this.contentEl)
				.setName('数字颜色')
				.addColorPicker((picker) => picker.setValue(this.numberColor).onChange((value) => (this.numberColor = value)));
		} else {
			new Setting(this.contentEl)
				.setName('排列方向')
				.setDesc('横排会利用卡片宽度分栏，竖排始终每行显示一个任务。')
				.addDropdown((dropdown) => dropdown
					.addOption('horizontal', '横排')
					.addOption('vertical', '竖排')
					.setValue(this.taskListDirection)
					.onChange((value) => (this.taskListDirection = value as 'horizontal' | 'vertical')));
			this.renderDisplayFields();
		}

		this.renderActions();
	}

	private renderActions(): void {
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('恢复默认').onClick(() => {
				this.title = '';
				this.numberColor = '';
				this.backgroundColor = defaultDashboardCardBackground(this.metric, this.kind);
				this.filterId = null;
				if (isDashboardModuleKind(this.kind)) this.moduleConfig = normalizeDashboardModuleConfig(this.kind, null);
				void this.save();
			}))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
	}

	private renderBackgroundSetting(): void {
		new Setting(this.contentEl)
			.setName('背景颜色')
			.setDesc('颜色会与当前主题背景柔和混合，保持卡片内容清晰可读。')
			.addColorPicker((picker) => picker.setValue(this.backgroundColor).onChange((value) => (this.backgroundColor = value)));
	}

	private renderMetricSetting(): void {
		const metrics: DashboardMetric[] = this.kind === 'percentage'
			? ['completion-rate', 'overdue-rate']
			: ['total', 'completed', 'incomplete', 'terminated', 'overdue'];
		if (!metrics.includes(this.metric)) this.metric = metrics[0]!;
		new Setting(this.contentEl)
			.setName(this.kind === 'task-list' ? '列表范围' : '统计指标')
			.addDropdown((dropdown) => {
				for (const metric of metrics) dropdown.addOption(metric, METRIC_LABELS[metric]);
				dropdown.setValue(this.metric).onChange((value) => {
					const usedDefault = this.backgroundColor === defaultDashboardCardBackground(this.metric, this.kind);
					this.metric = value as DashboardMetric;
					if (usedDefault) this.backgroundColor = defaultDashboardCardBackground(this.metric, this.kind);
					this.renderContent();
				});
			});
	}

	private renderPercentageSettings(): void {
		new Setting(this.contentEl).setName('百分比数据').addDropdown((dropdown) => dropdown
			.addOption('task', '任务统计')
			.addOption('manual', '手工输入')
			.setValue(this.percentageDataMode)
			.onChange((value) => {
				this.percentageDataMode = value === 'manual' ? 'manual' : 'task';
				this.renderContent();
			}));
		if (this.percentageDataMode === 'manual') {
			new Setting(this.contentEl).setName('当前值').addText((text) => text
				.setValue(String(this.percentageCurrent))
				.onChange((value) => (this.percentageCurrent = Math.max(0, Number(value) || 0))));
			new Setting(this.contentEl).setName('目标值').addText((text) => text
				.setValue(String(this.percentageTarget))
				.onChange((value) => (this.percentageTarget = Math.max(0.000001, Number(value) || 100))));
		}
		new Setting(this.contentEl).setName('展示方式').addDropdown((dropdown) => dropdown
			.addOption('number', '百分比数字')
			.addOption('progress', '进度条')
			.setValue(this.percentageDisplay)
			.onChange((value) => (this.percentageDisplay = value === 'progress' ? 'progress' : 'number')));
	}

	private renderDisplayFields(): void {
		const group = this.contentEl.createDiv({ cls: 'op-dashboard-field-settings' });
		group.createEl('h3', { text: '任务显示字段' });
		group.createEl('p', { text: '字段配置仅应用于当前卡片。' });
		const fields = group.createDiv({ cls: 'op-dashboard-sortable-fields' });
		const customFields = [...new Map(this.manager.projects.flatMap((project) => project.customFields).map((field) => [field.key, field])).values()];
		new SortableDisplayFields(this.displayFields, (next) => (this.displayFields = next), customFields).mount(fields);
	}

	private async save(): Promise<void> {
		try {
			await this.manager.savePersonalDashboardLayout(updateDashboardCard(
				this.manager.personalDashboardLayout,
				this.card.id,
				{
					kind: this.kind,
					metric: this.metric,
					filterId: this.filterId,
					displayFields: [...this.displayFields],
					taskListDirection: this.taskListDirection,
					title: this.title.trim() === this.defaultTitle ? undefined : this.title.trim() || undefined,
					numberColor: this.kind === 'number' || this.kind === 'percentage' ? this.numberColor || undefined : undefined,
					backgroundColor: this.backgroundColor,
					percentageDataMode: this.percentageDataMode,
					percentageCurrent: this.percentageCurrent,
					percentageTarget: this.percentageTarget,
					percentageDisplay: this.percentageDisplay,
					moduleConfig: isDashboardModuleKind(this.kind) ? this.moduleConfig : undefined,
				},
			));
			this.close();
			this.onSaved();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
