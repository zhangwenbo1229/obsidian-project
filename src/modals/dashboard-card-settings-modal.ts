import { Modal, Notice, Setting } from 'obsidian';
import type {
	DashboardCardKind,
	DashboardMetric,
	PersonalDashboardCardLayout,
	TaskDisplayField,
} from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { defaultDashboardCardBackground, updateDashboardCard } from '../views/dashboard-layout';
import { SortableDisplayFields } from '../settings/sortable-display-fields';

const CARD_KIND_LABELS: Record<DashboardCardKind, string> = {
	number: '数字',
	percentage: '百分比',
	'task-list': '任务列表',
};

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
	private title: string;
	private numberColor: string;
	private backgroundColor: string;
	private kind: DashboardCardKind;
	private metric: DashboardMetric;
	private filterId: string | null;
	private displayFields: TaskDisplayField[];
	private taskListDirection: 'horizontal' | 'vertical';

	constructor(
		private readonly manager: ProjectManager,
		private readonly card: PersonalDashboardCardLayout,
		private readonly defaultTitle: string,
		private readonly onSaved: () => void,
	) {
		super(manager.app);
		this.title = card.title ?? defaultTitle;
		this.numberColor = card.numberColor ?? '#0c66e4';
		this.backgroundColor = card.backgroundColor ?? defaultDashboardCardBackground(card.metric);
		this.kind = card.kind;
		this.metric = card.metric;
		this.filterId = card.filterId;
		this.displayFields = [...card.displayFields];
		this.taskListDirection = card.taskListDirection ?? 'horizontal';
	}

	onOpen(): void {
		this.setTitle('卡片设置');
		this.renderContent();
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
						this.backgroundColor = defaultDashboardCardBackground(this.metric);
					this.renderContent();
				});
			});

		new Setting(this.contentEl)
			.setName('数据源')
			.setDesc('使用全部任务，或绑定一个已保存的项目筛选器。')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '全部任务');
				for (const filter of this.manager.savedProjectFilters) dropdown.addOption(filter.id, filter.name);
				dropdown.setValue(this.filterId ?? '').onChange((value) => (this.filterId = value || null));
			});

		this.renderMetricSetting();
		if (this.kind !== 'task-list') {
			new Setting(this.contentEl)
				.setName('数字颜色')
				.addColorPicker((picker) => picker.setValue(this.numberColor).onChange((value) => (this.numberColor = value)));
			new Setting(this.contentEl)
				.setName('背景颜色')
				.setDesc('颜色会与当前主题背景柔和混合，保持标题和数字清晰可读。')
				.addColorPicker((picker) => picker.setValue(this.backgroundColor).onChange((value) => (this.backgroundColor = value)));
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

		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('恢复默认').onClick(() => {
				this.title = '';
				this.numberColor = '';
				this.backgroundColor = defaultDashboardCardBackground(this.metric);
				this.filterId = null;
				void this.save();
			}))
			.addButton((button) => button.setButtonText('保存').setCta().onClick(() => void this.save()));
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
					const usedDefault = this.backgroundColor === defaultDashboardCardBackground(this.metric);
					this.metric = value as DashboardMetric;
					if (usedDefault) this.backgroundColor = defaultDashboardCardBackground(this.metric);
					this.renderContent();
				});
			});
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
					numberColor: this.kind === 'task-list' ? undefined : this.numberColor || undefined,
					backgroundColor: this.kind === 'task-list' ? undefined : this.backgroundColor,
				},
			));
			this.close();
			this.onSaved();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
		}
	}
}
