import { Notice } from 'obsidian';
import type { TodoDashboardModuleConfig } from '../../domain/types';
import { createModuleBody, renderModuleMessage } from './card-ui';
import { collectIncompleteTodos, isTodoPathInScope, setMarkdownTodoCompleted, setMarkdownTodoText } from './todo-model';
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
			let openTimer: number | undefined;
			copy.addEventListener('click', () => {
				if (openTimer !== undefined) window.clearTimeout(openTimer);
				openTimer = window.setTimeout(() => void context.manager.app.workspace.getLeaf(false).openFile(file), 220);
			});
			copy.addEventListener('dblclick', (event) => {
				event.preventDefault();
				if (openTimer !== undefined) window.clearTimeout(openTimer);
				copy.hidden = true;
				const input = row.createEl('input', { cls: 'op-todo-inline-editor', attr: { type: 'text', 'aria-label': '编辑待办内容' } });
				input.value = todo.text;
				input.focus();
				input.select();
				let finished = false;
				const cancel = () => {
					if (finished) return;
					finished = true;
					input.remove();
					copy.hidden = false;
				};
				const save = async () => {
					if (finished) return;
					finished = true;
					input.disabled = true;
					try {
						await context.manager.app.vault.process(file, (markdown) => setMarkdownTodoText(markdown, todo.line, todo.text, input.value));
						context.refresh();
					} catch (error) {
						finished = false;
						input.disabled = false;
						input.focus();
						new Notice(error instanceof Error ? error.message : String(error));
					}
				};
				input.addEventListener('keydown', (keyEvent) => {
					if (keyEvent.key === 'Escape') cancel();
					else if (keyEvent.key === 'Enter') {
						keyEvent.preventDefault();
						void save();
					}
				});
				input.addEventListener('blur', () => void save());
			});
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
