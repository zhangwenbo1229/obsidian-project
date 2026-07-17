import { setIcon } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { TaskMetadataCustomFieldDefinition, TaskMetadataDisplayField } from '../settings/task-metadata-settings';
import { isInlineEditableTaskMetadata } from './task-metadata-inline-editor';

const LABELS: Record<TaskMetadataDisplayField, string> = {
	scheduledDate: '计划日期', dueDate: '截止日期', startDate: '开始日期', doneDate: '结束日期',
};

interface MetadataSource {
	priority?: 'high' | 'medium' | 'low' | 'normal';
	tags?: string[];
	scheduledDate?: string | null;
	startDate?: string | null;
	dueDate?: string | null;
	createdDate?: string | null;
	doneDate?: string | null;
	cancelledDate?: string | null;
	id?: string | null;
	custom?: Record<string, unknown>;
}

function valueFor(field: TaskMetadataDisplayField, source: MetadataSource, projectName?: string): string {
	void projectName;
	const value = source[field as keyof MetadataSource];
	return typeof value === 'string' ? value.slice(0, 10) : '';
}

export function formatTaskCustomMetadataValue(field: TaskMetadataCustomFieldDefinition, value: unknown): string {
	if (value === undefined || value === null || value === '') return '';
	if (field.type === 'boolean') return value === true ? '是' : '否';
	if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
	if (field.type === 'date') return typeof value === 'string' ? value.slice(0, 10) : '';
	const label = (item: unknown) => {
		const id = typeof item === 'string' || typeof item === 'number' ? String(item) : '';
		return field.options?.find((option) => option.id === id)?.name ?? id;
	};
	if (field.type === 'multi-select') return Array.isArray(value) ? value.map(label).filter(Boolean).join('、') : '';
	if (field.type === 'single-select') return label(value);
	return typeof value === 'string' || typeof value === 'number'
		? String(value).replace(/\s*\n\s*/gu, ' ')
		: '';
}

function renderMetadataIcon(parent: HTMLElement, icon: string): void {
	if (/^[a-z0-9][a-z0-9-]*$/iu.test(icon)) setIcon(parent, icon);
	else parent.textContent = icon;
}

export function renderTaskMetadata(
	parent: HTMLElement,
	source: MetadataSource,
	manager: ProjectManager,
	surface: 'taskView' | 'projectCards',
	projectName?: string,
	options?: { onEdit?(field: TaskMetadataDisplayField, target: HTMLElement): void },
): HTMLElement | null {
	const list = parent.createDiv({ cls: 'op-task-metadata' });
	let rendered = 0;
	for (const [field, presentation] of Object.entries(manager.taskMetadataSettings.fields) as Array<[TaskMetadataDisplayField, ProjectManager['taskMetadataSettings']['fields'][TaskMetadataDisplayField]]>) {
		if (!presentation.enabled) continue;
		if (surface === 'taskView' ? !presentation.showInTaskView : !presentation.showInProjectCards) continue;
		const text = valueFor(field, source, projectName);
		if (!text) continue;
		const editable = Boolean(options?.onEdit && isInlineEditableTaskMetadata(field));
		const item = editable
			? list.createEl('button', { cls: `op-task-metadata-item is-${field} is-editable`, attr: { type: 'button', title: `编辑${LABELS[field]}` } })
			: list.createSpan({ cls: `op-task-metadata-item is-${field}`, attr: { title: LABELS[field] } });
		item.style.setProperty('--op-task-metadata-color', presentation.color);
		const icon = item.createSpan({ cls: 'op-task-metadata-icon', attr: { 'aria-hidden': 'true' } });
		renderMetadataIcon(icon, presentation.icon);
		item.createSpan({ text });
		if (editable) item.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			options?.onEdit?.(field, item);
		});
		rendered += 1;
	}
	for (const field of manager.taskMetadataSettings.customFields) {
		if (surface === 'taskView' ? !field.showInTaskView : !field.showInProjectCards) continue;
		const text = formatTaskCustomMetadataValue(field, source.custom?.[field.key]);
		if (!text) continue;
		const item = list.createSpan({
			cls: 'op-task-metadata-item is-custom',
			attr: { title: field.name, 'data-field-key': field.key },
		});
		item.style.setProperty('--op-task-metadata-color', field.color);
		const icon = item.createSpan({ cls: 'op-task-metadata-icon', attr: { 'aria-hidden': 'true' } });
		renderMetadataIcon(icon, field.icon);
		item.createSpan({ text });
		rendered += 1;
	}
	if (rendered === 0) { list.remove(); return null; }
	return list;
}
