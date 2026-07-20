import { setIcon } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import type { TaskMetadataCustomFieldDefinition, TaskMetadataCustomFieldType, TaskMetadataDisplayField } from '../settings/task-metadata-settings';
import { isInlineEditableTaskMetadata } from './task-metadata-inline-editor';

const LABELS: Record<TaskMetadataDisplayField, string> = {
	scheduledDate: '计划日期', dueDate: '截止日期', startDate: '开始日期', doneDate: '结束日期',
};

// 扩展字段名映射，覆盖所有可能渲染的字段（包括内置非日期字段）
const FIELD_LABELS: Record<string, string> = {
	scheduledDate: '计划日期',
	dueDate: '截止日期',
	startDate: '开始日期',
	doneDate: '结束日期',
	endDate: '结束日期',
	priority: '优先级',
	tags: '标签',
};

interface MetadataSource {
	priority?: 'high' | 'medium' | 'low' | 'normal';
	tags?: string[];
	scheduledDate?: string | null;
	startDate?: string | null;
	dueDate?: string | null;
	endDate?: string | null;
	createdDate?: string | null;
	doneDate?: string | null;
	cancelledDate?: string | null;
	id?: string | null;
	custom?: Record<string, unknown>;
}

function valueForBuiltIn(key: string, source: MetadataSource): string {
	if (key === 'priority') {
		const value = source.priority;
		if (!value || value === 'normal') return '';
		const labels: Record<string, string> = { high: '高', medium: '中', low: '低' };
		return labels[value] ?? value;
	}
	if (key === 'tags') {
		const tags = source.tags;
		if (!tags || tags.length === 0) return '';
		return tags.map((t) => `#${t}`).join(' ');
	}
	// endDate 对子任务存储在 custom.endDate（EmbeddedSubtask 无 endDate 顶层属性）
	if (key === 'endDate') {
		const value = source.custom?.endDate;
		return typeof value === 'string' ? value.slice(0, 10) : '';
	}
	// 日期字段（scheduledDate、dueDate、startDate、doneDate 等）
	const value = source[key as keyof MetadataSource];
	return typeof value === 'string' ? value.slice(0, 10) : '';
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
	if (/^[a-z0-9][a-z0-9-]*$/iu.test(icon)) {
		setIcon(parent, icon);
		if (!parent.querySelector('svg')) parent.textContent = icon;
	} else parent.textContent = icon;
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
	// 统一元数据池：优先从 unifiedMetadataFields 读取 color/icon，让所有渲染由元数据管理控制
	const unifiedPool = manager.globalConfig.unifiedMetadataFields ?? [];
	const unifiedByKey = new Map(unifiedPool.map((f) => [f.key, f]));
	for (const [field, presentation] of Object.entries(manager.taskMetadataSettings.fields) as Array<[TaskMetadataDisplayField, ProjectManager['taskMetadataSettings']['fields'][TaskMetadataDisplayField]]>) {
		if (!presentation.enabled) continue;
		if (surface === 'taskView' ? !presentation.showInTaskView : !presentation.showInProjectCards) continue;
		const text = valueFor(field, source, projectName);
		if (!text) continue;
		// 优先从统一池读取 color/icon，回退到 taskMetadataSettings.fields 的 presentation
		const unified = unifiedByKey.get(field);
		const color = unified?.color ?? presentation.color;
		const icon = unified?.icon ?? presentation.icon;
		const editable = Boolean(options?.onEdit && isInlineEditableTaskMetadata(field));
		const item = editable
			? list.createEl('button', { cls: `op-task-metadata-item is-${field} is-editable`, attr: { type: 'button', title: `编辑${LABELS[field]}` } })
			: list.createSpan({ cls: `op-task-metadata-item is-${field}`, attr: { title: LABELS[field] } });
		item.style.setProperty('--op-task-metadata-color', color);
		const iconEl = item.createSpan({ cls: 'op-task-metadata-icon', attr: { 'aria-hidden': 'true' } });
		renderMetadataIcon(iconEl, icon);
		item.createSpan({ cls: 'op-task-metadata-label', text: `${LABELS[field] ?? field}:` });
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
		// 优先从统一池读取 color/icon，回退到 field.color/icon
		const unified = unifiedByKey.get(field.key);
		const color = unified?.color ?? field.color;
		const icon = unified?.icon ?? field.icon;
		const item = list.createSpan({
			cls: 'op-task-metadata-item is-custom',
			attr: { title: field.name, 'data-field-key': field.key },
		});
		item.style.setProperty('--op-task-metadata-color', color);
		const iconEl = item.createSpan({ cls: 'op-task-metadata-icon', attr: { 'aria-hidden': 'true' } });
		renderMetadataIcon(iconEl, icon);
		item.createSpan({ cls: 'op-task-metadata-label', text: `${field.name}:` });
		item.createSpan({ text });
		rendered += 1;
	}
	// 新版 customFieldRefs + 统一元数据字段池
	const refs = manager.taskMetadataSettings.customFieldRefs ?? [];
	if (refs.length > 0) {
		const pool = manager.globalConfig.unifiedMetadataFields ?? [];
		const unifiedById = new Map(pool.map((f) => [f.id, f]));
		for (const ref of refs) {
			if (surface === 'taskView' ? !ref.showInTaskView : !ref.showInProjectCards) continue;
			const unified = unifiedById.get(ref.unifiedMetadataFieldId);
			if (!unified) continue;
			// 内置字段从任务顶层属性读取值，非内置字段从 custom 对象读取
			const text = unified.isBuiltIn
				? valueForBuiltIn(unified.key, source)
				: formatTaskCustomMetadataValue({
					id: unified.id,
					key: unified.key,
					name: unified.name,
					type: unified.type as TaskMetadataCustomFieldType,
					required: unified.required,
					defaultValue: unified.defaultValue,
					icon: unified.icon,
					color: unified.color,
					options: unified.options,
					showInTaskView: ref.showInTaskView,
					showInProjectCards: ref.showInProjectCards,
				}, source.custom?.[unified.key]);
			if (!text) continue;
			const item = list.createSpan({
			cls: 'op-task-metadata-item is-custom',
			attr: { title: unified.name, 'data-field-key': unified.key },
		});
		item.style.setProperty('--op-task-metadata-color', unified.color);
		const icon = item.createSpan({ cls: 'op-task-metadata-icon', attr: { 'aria-hidden': 'true' } });
		renderMetadataIcon(icon, unified.icon);
		item.createSpan({ cls: 'op-task-metadata-label', text: `${unified.name}:` });
		item.createSpan({ text });
		rendered += 1;
		}
	}
	if (rendered === 0) { list.remove(); return null; }
	return list;
}
