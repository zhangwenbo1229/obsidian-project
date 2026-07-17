import { setIcon } from 'obsidian';
import type { IndexedTask } from '../index/task-index';
import { parseEmbeddedSubtasks } from '../markdown/embedded-subtask-parser';
import type { ProjectManager } from '../services/project-manager';
import { CreateSubtaskModal } from './create-subtask-modal';
import { EditSubtaskModal } from './edit-subtask-modal';
import { addDraftSubtask, deleteDraftSubtask, updateDraftSubtask } from './subtask-draft';

export interface SubtaskListEditorOptions {
	manager: ProjectManager;
	value: string;
	parent: IndexedTask | null;
	parentLabel: string;
	onChange(value: string): void;
	onRerender(): void;
}

export function renderSubtaskListEditor(container: HTMLElement, options: SubtaskListEditorOptions): void {
	const parsed = parseEmbeddedSubtasks(options.value);
	const toolbar = container.createDiv({ cls: 'op-task-dialog-task-toolbar' });
	const summary = toolbar.createDiv({ cls: 'op-task-dialog-task-summary' });
	summary.createEl('strong', { text: '当前项目已有任务' });
	summary.createSpan({ text: `${parsed.subtasks.length} 个` });
	const add = toolbar.createEl('button', { cls: 'mod-cta', attr: { type: 'button' } });
	setIcon(add.createSpan(), 'plus');
	add.createSpan({ text: '新增任务' });
	add.addEventListener('click', () => new CreateSubtaskModal(
		options.manager,
		options.parent ?? undefined,
		async (subtask) => {
			options.onChange(addDraftSubtask(options.value, subtask));
			options.onRerender();
		},
		options.parentLabel,
	).open());

	const list = container.createDiv({ cls: 'op-task-dialog-task-list' });
	if (parsed.subtasks.length === 0) list.createDiv({ cls: 'op-task-dialog-empty', text: '当前项目还没有结构化任务。' });
	for (const subtask of parsed.subtasks) {
		const row = list.createDiv({ cls: `op-task-dialog-task-row${subtask.completed ? ' is-completed' : ''}` });
		setIcon(row.createSpan({ cls: 'op-task-dialog-task-state' }), subtask.completed ? 'circle-check-big' : 'circle');
		const details = row.createDiv({ cls: 'op-task-dialog-task-details' });
		details.createEl('strong', { text: subtask.title });
		const metadata = [
			subtask.priority === 'high' ? '高优先级' : subtask.priority === 'low' ? '低优先级' : '中优先级',
			subtask.scheduledDate ? `计划 ${subtask.scheduledDate.slice(0, 10)}` : '',
			subtask.dueDate ? `截止 ${subtask.dueDate.slice(0, 10)}` : '',
			...subtask.tags.map((tag) => `#${tag}`),
		].filter(Boolean);
		if (metadata.length > 0) details.createSpan({ text: metadata.join(' · ') });
		const edit = row.createEl('button', { cls: 'op-task-dialog-task-edit', attr: { type: 'button', 'aria-label': `编辑任务：${subtask.title}` } });
		setIcon(edit, 'pencil');
		edit.addEventListener('click', () => new EditSubtaskModal(options.manager, options.parent, subtask, {
			parentLabel: options.parentLabel,
			onSave: async (next) => {
				options.onChange(updateDraftSubtask(options.value, next));
				options.onRerender();
			},
			onDelete: async (id) => {
				options.onChange(deleteDraftSubtask(options.value, id));
				options.onRerender();
			},
		}).open());
	}

	if (parsed.legacyMarkdown) {
		const legacyLines = parsed.legacyMarkdown.split(/\r?\n/u).filter((line) => line.trim()).length;
		container.createDiv({
			cls: 'op-task-dialog-task-legacy-note',
			text: `另保留 ${legacyLines} 条旧格式 Markdown 任务；保存项目时不会删除。`,
		});
	}
}
