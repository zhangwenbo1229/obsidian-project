import type { Component } from 'obsidian';
import type { TaskDisplayField } from '../domain/types';
import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';
import { EditTaskModal } from '../modals/edit-task-modal';
import { resizeColumnWidth, totalColumnWidth } from './column-widths';
import { isInteractiveTaskCardTarget } from './task-card-interaction';
import { renderTaskListField } from './task-card-fields';
import { beginProjectListInlineEdit, projectListEditorKind } from './project-list-inline-editor';
import { openTaskCardContextMenu } from './task-card-context-menu';

export interface ProjectListColumn {
	id: string;
	name: string;
}

export interface ProjectListRenderOptions {
	parent: HTMLElement;
	tasks: readonly IndexedTask[];
	columns: readonly ProjectListColumn[];
	columnWidths: Record<string, number>;
	sortColumn: string;
	sortAscending: boolean;
	manager: ProjectManager;
	component: Component;
	value(task: IndexedTask, column: string): string;
	onSort(column: string, ascending: boolean): void;
}

export function renderProjectList(options: ProjectListRenderOptions): void {
	const { parent, columns, columnWidths } = options;
	parent.addClass('op-list-scroll');
	const viewport = parent.createDiv({ cls: 'op-list-scroll-viewport' });
	const scrollbar = parent.createDiv({ cls: 'op-list-scrollbar', attr: { 'aria-label': '列表横向滚动条' } });
	const scrollbarSpacer = scrollbar.createDiv({ cls: 'op-list-scrollbar-spacer' });
	const sorted = [...options.tasks].sort((left, right) => {
		const result = options.value(left, options.sortColumn).localeCompare(options.value(right, options.sortColumn), 'zh-CN');
		return options.sortAscending ? result : -result;
	});
	const table = viewport.createEl('table', { cls: 'op-table' });
	const updateTableWidth = () => {
		const width = totalColumnWidth(columns.map((column) => columnWidths[column.id] ?? 140));
		table.style.width = `${width}px`;
		scrollbarSpacer.style.width = `${width}px`;
	};
	updateTableWidth();
	const header = table.createEl('thead').createEl('tr');
	for (const column of columns) {
		const cell = header.createEl('th');
		cell.style.width = `${columnWidths[column.id] ?? 140}px`;
		const button = cell.createEl('button', { text: column.name });
		button.addEventListener('click', () => options.onSort(
			column.id,
			options.sortColumn === column.id ? !options.sortAscending : true,
		));
		const handle = cell.createSpan({ cls: 'op-column-resize-handle' });
		handle.addEventListener('pointerdown', (event) => {
			event.preventDefault();
			event.stopPropagation();
			const startX = event.clientX;
			const startWidth = columnWidths[column.id] ?? cell.getBoundingClientRect().width;
			handle.setPointerCapture(event.pointerId);
			const move = (moveEvent: PointerEvent) => {
				const width = resizeColumnWidth(startWidth, moveEvent.clientX - startX);
				cell.style.width = `${width}px`;
				columnWidths[column.id] = width;
				updateTableWidth();
			};
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', move), { once: true });
		});
	}
	const body = table.createEl('tbody');
	let rendered = 0;
	const appendChunk = () => {
		for (const task of sorted.slice(rendered, rendered + 100)) {
			const row = body.createEl('tr');
			for (const column of columns) {
				const cell = row.createEl('td');
				cell.style.width = `${columnWidths[column.id] ?? 140}px`;
				renderTaskListField(cell, task, options.manager, column.id as TaskDisplayField, options.component);
				if (projectListEditorKind(task, column.id)) {
					cell.setAttr('data-editable', 'true');
					cell.setAttr('title', '双击编辑字段');
					cell.addEventListener('click', (event) => event.stopPropagation());
					cell.addEventListener('dblclick', (event) => {
						event.preventDefault();
						event.stopPropagation();
						beginProjectListInlineEdit(cell, task, column.id, options.manager);
					});
				}
			}
			row.addEventListener('click', (event) => {
				if (!isInteractiveTaskCardTarget(event.target)) new EditTaskModal(options.manager, task).open();
			});
			row.addEventListener('contextmenu', (event) => openTaskCardContextMenu(event, task, options.manager));
		}
		rendered = Math.min(sorted.length, rendered + 100);
	};
	appendChunk();
	let syncingHorizontalScroll = false;
	const syncScroll = (source: HTMLElement, target: HTMLElement) => {
		if (syncingHorizontalScroll) return;
		syncingHorizontalScroll = true;
		target.scrollLeft = source.scrollLeft;
		syncingHorizontalScroll = false;
	};
	viewport.addEventListener('scroll', () => {
		syncScroll(viewport, scrollbar);
		if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 80 && rendered < sorted.length) appendChunk();
	});
	scrollbar.addEventListener('scroll', () => syncScroll(scrollbar, viewport));
}
