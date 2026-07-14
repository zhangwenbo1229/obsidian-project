import { App, Modal, setIcon } from 'obsidian';

export const TASK_MARKER_OPTIONS = [
	{ value: 'circle-check', label: '任务' },
	{ value: 'clipboard-list', label: '任务清单' },
	{ value: 'list-checks', label: '检查清单' },
	{ value: 'square-check-big', label: '完成事项' },
	{ value: 'bug', label: '缺陷' },
	{ value: 'bug-off', label: '缺陷修复' },
	{ value: 'lightbulb', label: '需求' },
	{ value: 'sparkles', label: '改进' },
	{ value: 'wand-sparkles', label: '优化' },
	{ value: 'bookmark', label: '书签' },
	{ value: 'flag', label: '标记' },
	{ value: 'milestone', label: '里程碑' },
	{ value: 'rocket', label: '发布' },
	{ value: 'package-check', label: '交付' },
	{ value: 'git-merge', label: '合并' },
	{ value: 'git-pull-request', label: '合并请求' },
	{ value: 'wrench', label: '维护' },
	{ value: 'settings', label: '配置' },
	{ value: 'shield-alert', label: '安全' },
	{ value: 'shield-check', label: '安全检查' },
	{ value: 'triangle-alert', label: '风险' },
	{ value: 'circle-alert', label: '告警' },
	{ value: 'file-text', label: '文档' },
	{ value: 'notebook-text', label: '说明' },
	{ value: 'book-open', label: '知识库' },
	{ value: 'message-square', label: '沟通' },
	{ value: 'messages-square', label: '讨论' },
	{ value: 'calendar-clock', label: '计划' },
	{ value: 'calendar-days', label: '日程' },
	{ value: 'clock-3', label: '待办' },
	{ value: 'timer', label: '计时' },
	{ value: 'users', label: '团队' },
	{ value: 'user-round', label: '用户' },
	{ value: 'contact', label: '客户' },
	{ value: 'code-2', label: '开发' },
	{ value: 'terminal', label: '命令行' },
	{ value: 'braces', label: '代码' },
	{ value: 'database', label: '数据库' },
	{ value: 'server', label: '服务端' },
	{ value: 'cloud', label: '云服务' },
	{ value: 'plug-zap', label: '集成' },
	{ value: 'network', label: '网络' },
	{ value: 'test-tube-2', label: '测试' },
	{ value: 'flask-conical', label: '实验' },
	{ value: 'search-check', label: '验证' },
	{ value: 'palette', label: '设计' },
	{ value: 'layout-template', label: '界面' },
	{ value: 'smartphone', label: '移动端' },
	{ value: 'monitor', label: '桌面端' },
	{ value: 'globe-2', label: '网站' },
	{ value: 'chart-no-axes-column-increasing', label: '数据分析' },
	{ value: 'badge-dollar-sign', label: '财务' },
	{ value: 'headphones', label: '支持' },
	{ value: 'life-buoy', label: '服务' },
	{ value: 'thumbs-up', label: '认可' },
	{ value: 'star', label: '重点' },
	{ value: 'heart', label: '关注' },
	{ value: 'zap', label: '紧急' },
	{ value: 'circle-help', label: '问题' },
	{ value: 'link', label: '链接' },
	{ value: 'paperclip', label: '附件' },
	{ value: '✅', label: '完成 emoji' },
	{ value: '📋', label: '任务清单 emoji' },
	{ value: '🐞', label: '缺陷 emoji' },
	{ value: '💡', label: '想法 emoji' },
	{ value: '🚀', label: '发布 emoji' },
	{ value: '📌', label: '重点 emoji' },
	{ value: '📝', label: '记录 emoji' },
	{ value: '🔧', label: '维护 emoji' },
	{ value: '🧪', label: '测试 emoji' },
	{ value: '🎨', label: '设计 emoji' },
	{ value: '📚', label: '文档 emoji' },
	{ value: '🔒', label: '安全 emoji' },
	{ value: '⚠️', label: '风险 emoji' },
	{ value: '👥', label: '团队 emoji' },
	{ value: '📊', label: '数据 emoji' },
	{ value: '🗓️', label: '计划 emoji' },
	{ value: '⭐', label: '收藏 emoji' },
] as const;

export class TaskMarkerPickerModal extends Modal {
	private query = '';

	constructor(
		app: App,
		private readonly selected: string,
		private readonly onSelect: (marker: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('选择任务标识');
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.addClass('op-marker-picker');
		const search = this.contentEl.createEl('input', {
			type: 'search',
			placeholder: '搜索图标或 emoji',
			attr: { 'aria-label': '搜索任务标识' },
		});
		search.value = this.query;
		search.addEventListener('input', () => {
			this.query = search.value;
			this.render();
		});
		const grid = this.contentEl.createDiv({ cls: 'op-marker-picker-grid' });
		const query = this.query.trim().toLocaleLowerCase('zh-CN');
		for (const marker of TASK_MARKER_OPTIONS.filter((item) => !query || `${item.label} ${item.value}`.toLocaleLowerCase('zh-CN').includes(query))) {
			const button = grid.createEl('button', {
				cls: 'op-marker-picker-option',
				attr: { type: 'button', title: `${marker.label} · ${marker.value}`, 'aria-label': marker.label },
			});
			button.toggleClass('is-selected', marker.value === this.selected);
			const preview = button.createSpan({ cls: 'op-marker-picker-preview' });
			if (/^[a-z0-9][a-z0-9-]*$/iu.test(marker.value)) setIcon(preview, marker.value);
			else preview.setText(marker.value);
			button.createSpan({ cls: 'op-marker-picker-label', text: marker.label });
			button.addEventListener('click', () => {
				this.onSelect(marker.value);
				this.close();
			});
		}
	}
}
