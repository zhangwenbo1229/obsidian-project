import { MarkdownRenderer, setIcon, type Component } from 'obsidian';
import type { IndexedTask } from '../index/task-index';
import { parseEmbeddedSubtasks } from '../markdown/embedded-subtask-parser';
import { EditSubtaskModal } from '../modals/edit-subtask-modal';
import type { ProjectManager } from '../services/project-manager';
import { enhanceRenderedTaskLists } from './subtask-presentation';
import { renderTaskMetadata } from './task-metadata-presentation';

export function renderEmbeddedSubtasks(
	parent: HTMLElement,
	value: string,
	task: IndexedTask,
	manager: ProjectManager,
	component: Component,
): void {
	const parsed = parseEmbeddedSubtasks(value);
	if (parsed.subtasks.length > 0) {
		const list = parent.createDiv({ cls: 'op-embedded-subtask-list' });
		for (const subtask of parsed.subtasks) {
			const row = list.createDiv({ cls: `op-embedded-subtask${subtask.completed ? ' is-completed' : ''}` });
			const checkbox = row.createEl('input', { type: 'checkbox', cls: 'op-embedded-subtask-checkbox', attr: { 'aria-label': `完成任务：${subtask.title}` } });
			checkbox.checked = subtask.completed;
			checkbox.addEventListener('click', (event) => event.stopPropagation());
			checkbox.addEventListener('change', () => {
				checkbox.disabled = true;
				void manager.toggleEmbeddedSubtask(task, subtask.id, checkbox.checked).catch(() => {
					checkbox.checked = !checkbox.checked;
					checkbox.disabled = false;
				});
			});
			const content = row.createEl('button', { cls: 'op-embedded-subtask-content', attr: { type: 'button', title: '编辑任务' } });
			content.createSpan({ cls: 'op-embedded-subtask-title', text: subtask.title });
			renderTaskMetadata(content, subtask, manager, 'projectCards', `${task.project.code} · ${task.project.name}`);
			content.addEventListener('click', (event) => {
				event.stopPropagation();
				new EditSubtaskModal(manager, task, subtask).open();
			});
			const editIcon = row.createSpan({ cls: 'op-embedded-subtask-edit', attr: { 'aria-hidden': 'true' } });
			setIcon(editIcon, 'pencil');
		}
	}
	if (parsed.legacyMarkdown) {
		const legacy = parent.createDiv({ cls: 'op-card-markdown op-embedded-subtask-legacy' });
		void MarkdownRenderer.render(manager.app, parsed.legacyMarkdown, legacy, task.path, component)
			.then(() => enhanceRenderedTaskLists(legacy));
	}
}
