import { Notice } from 'obsidian';
import type { TodoDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { collectIncompleteTodos, isTodoPathInScope, setMarkdownTodoCompleted } from './todo-model';
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
		const row = list.createDiv({ cls: 'op-todo-item', attr: { title: `${todo.path}:${todo.line}` } });
		const checkbox = row.createEl('input', { cls: 'op-todo-checkbox', attr: { type: 'checkbox', 'aria-label': `完成待办：${todo.text}` } });
		const copy = row.createEl('button', { cls: 'op-todo-copy', attr: { type: 'button' } });
		copy.createSpan({ text: todo.text });
		if (config.showSource) copy.createEl('small', { text: `${todo.path} · 第 ${todo.line} 行` });
		if (file) {
			copy.addEventListener('click', () => void context.manager.app.workspace.getLeaf(false).openFile(file));
			checkbox.addEventListener('change', () => {
				checkbox.disabled = true;
				void context.manager.app.vault.process(file, (markdown) => setMarkdownTodoCompleted(markdown, todo.line, checkbox.checked))
					.then(() => context.refresh())
					.catch((error: unknown) => {
						checkbox.checked = false;
						checkbox.disabled = false;
						new Notice(error instanceof Error ? error.message : String(error));
					});
			});
		}
	}
}

export const todoDefinition: DashboardModuleDefinition = {
	kind: 'todo', label: '待办', icon: 'list-todo', render: renderTodo, renderSettings: renderTodoSettings,
};
