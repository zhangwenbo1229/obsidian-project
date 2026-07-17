import type { IndexedTask } from '../index/task-index';

export type ProjectViewMode = 'list' | 'board' | 'calendar' | 'quadrants';

export interface ProjectViewContentRendererContext {
	container: HTMLElement;
	mode: ProjectViewMode;
	tasks: readonly IndexedTask[];
	renderList(parent: HTMLElement, tasks: readonly IndexedTask[]): void;
	renderBoard(parent: HTMLElement, tasks: readonly IndexedTask[]): void;
	renderCalendar(parent: HTMLElement, tasks: readonly IndexedTask[]): void;
	renderQuadrants(parent: HTMLElement, tasks: readonly IndexedTask[]): void;
}

const MODE_DESCRIPTIONS: Record<ProjectViewMode, string> = {
	list: '点击表头可临时排序',
	board: '按工作流状态分组',
	calendar: '按开始日期与计划日期展示',
	quadrants: '高优先级为重要，3 天内到期为紧急',
};

export function renderProjectViewContent(context: ProjectViewContentRendererContext): void {
	context.container.querySelector('.op-project-content')?.remove();
	const ownerDocument = context.container.ownerDocument;
	const content = ownerDocument.createElement('div');
	content.className = 'op-project-content';
	context.container.append(content);
	const results = ownerDocument.createElement('div');
	results.className = 'op-results-bar';
	content.append(results);
	const count = ownerDocument.createElement('strong');
	count.textContent = `${context.tasks.length} 个任务`;
	results.append(count);
	const description = ownerDocument.createElement('span');
	description.textContent = MODE_DESCRIPTIONS[context.mode];
	results.append(description);
	const surface = ownerDocument.createElement('div');
	surface.className = 'op-mode-surface';
	content.append(surface);
	if (context.mode === 'board') context.renderBoard(surface, context.tasks);
	else if (context.mode === 'calendar') context.renderCalendar(surface, context.tasks);
	else if (context.mode === 'quadrants') context.renderQuadrants(surface, context.tasks);
	else context.renderList(surface, context.tasks);
}
