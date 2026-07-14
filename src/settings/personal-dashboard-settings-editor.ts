import { Notice, Setting } from 'obsidian';
import type { DashboardCardKind } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import {
	ALL_DASHBOARD_CARD_KINDS,
	normalizePersonalDashboardSettings,
	type PersonalDashboardSettings,
} from '../views/personal-dashboard-settings';

const CARD_KIND_LABELS: Record<DashboardCardKind, string> = {
	number: '数字卡片',
	percentage: '百分比卡片',
	'task-list': '任务列表卡片',
	weather: '天气卡片',
	calendar: '日历卡片',
	'note-stats': '笔记统计卡片',
	'recent-files': '最近文件卡片',
	news: '资讯卡片',
	directory: '目录卡片',
	text: '文本卡片',
	chart: '图表卡片',
};

export class PersonalDashboardSettingsEditor {
	private value: PersonalDashboardSettings;

	constructor(private readonly manager: ProjectManager) {
		this.value = normalizePersonalDashboardSettings(manager.personalDashboardSettings);
	}

	mount(container: HTMLElement): void {
		new Setting(container)
			.setName('个人视图自定义卡片')
			.setDesc('只有开启的类型才会出现在个人视图空白处的右键新增菜单中；已创建的卡片不会被删除。')
			.setHeading();
		const enabled = new Set(this.value.enabledCardKinds);
		for (const kind of ALL_DASHBOARD_CARD_KINDS) {
			new Setting(container)
				.setName(CARD_KIND_LABELS[kind])
				.addToggle((toggle) => toggle.setValue(enabled.has(kind)).onChange((active) => {
					if (active) enabled.add(kind);
					else enabled.delete(kind);
					this.value = {
						enabledCardKinds: ALL_DASHBOARD_CARD_KINDS.filter((candidate) => enabled.has(candidate)),
					};
				}));
		}
		new Setting(container).addButton((button) => button
			.setButtonText('保存个人视图卡片配置')
			.setCta()
			.onClick(() => void this.manager.savePersonalDashboardSettings(this.value)
				.then(() => new Notice('个人视图卡片配置已保存。'))
				.catch((error: unknown) => new Notice(error instanceof Error ? error.message : String(error)))));
	}
}
