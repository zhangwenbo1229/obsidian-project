import { setIcon } from 'obsidian';
import type { TodoDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { collectIncompleteTodos, isTodoPathInScope } from './todo-model';
import { renderTodoSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';

async function renderTodo(context: DashboardModuleRenderContext): Promise<void> {
	const config = context.card.moduleConfig as TodoDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-todo-card');
	renderModuleMessage(body, 'loader-circle', '正在收集待办', '正在读取指定目录中的 Markdown 任务。', 'op-dashboard-module-loading');
	const files = context.manager.app.vault.getMarkdownFiles()
		.filter((file) => isTodoPathInScope(file.path, config.rootPaths, config.excludePaths));
	const sources = await Promise.all(files.map(async (file) => ({ path: file.path, content: await context.manager.app.vault.cachedRead(file), file })));
	if (!context.isCurrent()) return;
	const todos = collectIncompleteTodos(sources, config.rootPaths, config.excludePaths, config.limit);
	body.empty();
	if (todos.length === 0) {
		renderModuleMessage(body, 'circle-check-big', '没有未完成待办', '指定目录中的 Markdown 任务均已完成。');
		return;
	}
	const list = body.createDiv({ cls: 'op-todo-list' });
	for (const todo of todos) {
		const file = sources.find((source) => source.path === todo.path)?.file;
		const button = list.createEl('button', { cls: 'op-todo-item', attr: { type: 'button', title: `${todo.path}:${todo.line}` } });
		const icon = button.createSpan({ cls: 'op-todo-checkbox' });
		setIcon(icon, 'square');
		const copy = button.createSpan({ cls: 'op-todo-copy' });
		copy.createSpan({ text: todo.text });
		if (config.showSource) copy.createEl('small', { text: `${todo.path} · 第 ${todo.line} 行` });
		if (file) button.addEventListener('click', () => void context.manager.app.workspace.getLeaf(false).openFile(file));
	}
}

export const todoDefinition: DashboardModuleDefinition = {
	kind: 'todo', label: '待办', icon: 'list-todo', render: renderTodo, renderSettings: renderTodoSettings,
};
