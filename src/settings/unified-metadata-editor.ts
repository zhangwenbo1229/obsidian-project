import { Modal, Notice, Setting, setIcon } from 'obsidian';
import type {
	UnifiedFieldType,
	UnifiedMetadataField,
	ProjectTemplateMetadataRef,
	PersonMetadataRef,
	TaskMetadataRef,
} from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { createUuid } from '../utils/ids';
import { TaskMarkerPickerModal } from '../modals/task-marker-picker-modal';
import { BUILT_IN_FIELD_DEFINITIONS } from '../domain/built-in-fields';

const FIELD_TYPE_LABELS: Record<UnifiedFieldType, string> = {
	text: '单行文本',
	'multiline-text': '多行文本',
	number: '数字',
	boolean: '是/否',
	date: '日期',
	datetime: '日期时间',
	'single-select': '单选',
	'multi-select': '多选',
	user: '用户',
	'task-reference': '项目引用',
};

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as UnifiedFieldType[];

/** Track whether there are unsaved changes */
let hasUnsavedChanges = false;

export function renderUnifiedMetadataEditor(container: HTMLElement, manager: ProjectManager): void {
	const rawFields = manager.globalConfig.unifiedMetadataFields ?? [];
	// Sort: built-in fields first, then custom fields
	const fields = [...rawFields].sort((a, b) => {
		if (a.isBuiltIn && !b.isBuiltIn) return -1;
		if (!a.isBuiltIn && b.isBuiltIn) return 1;
		return 0;
	});
	const personRefs = manager.globalConfig.personMetadataRefs ?? [];
	const taskRefs = manager.taskMetadataSettings.customFieldRefs ?? [];

	// Heading
	new Setting(container)
		.setName('统一元数据管理')
		.setDesc('定义全局元数据字段池，供项目模板、人员元数据和任务自定义字段引用。内置字段不可删除或更改类型。')
		.setHeading();

	// Add button
	new Setting(container)
		.addButton((button) => button
			.setButtonText('新增元数据')
			.setCta()
			.onClick(() => {
				const index = fields.length + 1;
				fields.push({
					id: createUuid(),
					key: `field_${index}`,
					name: `元数据字段 ${index}`,
					type: 'text',
					icon: 'brackets',
					color: '#626f86',
					required: false,
					defaultValue: null,
				});
				manager.globalConfig.unifiedMetadataFields = fields;
				hasUnsavedChanges = true;
				rerender(container, manager);
			}));

	if (fields.length === 0) {
		container.createDiv({ cls: 'op-settings-empty', text: '暂无元数据字段，点击上方按钮新增。' });
		return;
	}

	for (const [index, field] of fields.entries()) {
		renderFieldRow(container, field, index, fields, manager, personRefs, taskRefs);
	}

	// Save button at the bottom + 重置元数据配置按钮
	new Setting(container)
		.addButton((button) => button
			.setButtonText(hasUnsavedChanges ? '保存元数据配置 ●' : '保存元数据配置')
			.setCta()
			.setDisabled(!hasUnsavedChanges)
			.onClick(() => void saveAll(manager, container)))
		.addButton((button) => button
			.setButtonText('重置元数据配置')
			.setTooltip('将所有内置字段的颜色和图标恢复为默认值（不影响自定义字段）')
			.onClick(() => resetMetadata(manager, container)));
}

let dragSourceIndex = -1;

function renderFieldRow(
	container: HTMLElement,
	field: UnifiedMetadataField,
	index: number,
	fields: UnifiedMetadataField[],
	manager: ProjectManager,
	personRefs: PersonMetadataRef[],
	taskRefs: TaskMetadataRef[],
): void {
	const card = container.createDiv({ cls: 'op-unified-metadata-field' });
	const isBuiltIn = field.isBuiltIn === true;

	if (!isBuiltIn) {
		card.setAttribute('draggable', 'true');
		const dragHandle = card.createDiv({ cls: 'op-unified-metadata-drag-handle' });
		dragHandle.setAttribute('aria-label', '拖拽排序');
		dragHandle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';
		card.addEventListener('dragstart', (event) => {
			dragSourceIndex = index;
			event.dataTransfer!.effectAllowed = 'move';
			card.classList.add('is-dragging');
		});
		card.addEventListener('dragend', () => {
			card.classList.remove('is-dragging');
			// Remove all drag-over indicators
			container.querySelectorAll('.op-unified-metadata-field.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
		});
		card.addEventListener('dragover', (event) => {
			event.preventDefault();
			event.dataTransfer!.dropEffect = 'move';
			container.querySelectorAll('.op-unified-metadata-field.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
			card.classList.add('is-drag-over');
		});
		card.addEventListener('drop', (event) => {
			event.preventDefault();
			card.classList.remove('is-drag-over');
			if (dragSourceIndex < 0 || dragSourceIndex === index) return;
			const [moved] = fields.splice(dragSourceIndex, 1);
			if (moved) fields.splice(index, 0, moved);
			hasUnsavedChanges = true;
			dragSourceIndex = -1;
			rerender(container, manager);
		});
		card.addEventListener('dragleave', () => {
			card.classList.remove('is-drag-over');
		});
	}

	const descParts = [`键：${field.key}`, `类型：${FIELD_TYPE_LABELS[field.type]}`];
	if (isBuiltIn) descParts.push('内置');

	const setting = new Setting(card)
		.setName(field.name)
		.setDesc(descParts.join(' · '))
		.addToggle((toggle) => toggle
			.setTooltip('必填')
			.setValue(field.required)
			.onChange((value) => {
				field.required = value;
				hasUnsavedChanges = true;
				rerender(container, manager);
			}))
		.addExtraButton((button) => button
			.setIcon('pencil')
			.setTooltip('编辑')
			.onClick(() => toggleEdit(card, field, fields, manager, container, personRefs, taskRefs)))
		.addExtraButton((button) => {
			if (!isBuiltIn) {
				button
					.setIcon('trash-2')
					.setTooltip('删除')
					.onClick(() => confirmDelete(field, fields, manager, container));
			} else {
				// Hide the button for built-in fields
				button.setIcon('').setTooltip('').extraSettingsEl.style.display = 'none';
			}
		});
	// 在标题下方信息区域显示图标徽章和颜色色块，让用户直观看到当前配置
	const infoEl = setting.descEl;
	const badgeRow = infoEl.createDiv({ cls: 'op-unified-metadata-info-badges' });
	const iconBadge = badgeRow.createSpan({ cls: 'op-unified-metadata-icon-badge', attr: { 'aria-label': `图标：${field.icon}`, title: `图标：${field.icon}` } });
	try { setIcon(iconBadge, field.icon); } catch { iconBadge.textContent = field.icon; }
	iconBadge.style.color = field.color;
	const colorBadge = badgeRow.createSpan({ cls: 'op-unified-metadata-color-badge', attr: { 'aria-label': `颜色：${field.color}`, title: `颜色：${field.color}` } });
	colorBadge.style.backgroundColor = field.color;
	badgeRow.createSpan({ cls: 'op-unified-metadata-info-text', text: field.icon });
	badgeRow.createSpan({ cls: 'op-unified-metadata-info-text', text: field.color });
}

function toggleEdit(
	card: HTMLElement,
	field: UnifiedMetadataField,
	fields: UnifiedMetadataField[],
	manager: ProjectManager,
	container: HTMLElement,
	personRefs: PersonMetadataRef[],
	taskRefs: TaskMetadataRef[],
): void {
	const existing = card.querySelector('.op-unified-metadata-edit') as HTMLElement | null;
	if (existing) {
		existing.remove();
		return;
	}

	const isBuiltIn = field.isBuiltIn === true;
	const editSection = card.createDiv({ cls: 'op-unified-metadata-edit' });

	new Setting(editSection)
		.setName('字段键')
		.addText((text) => {
			text.setValue(field.key).onChange((value) => { field.key = value.trim(); hasUnsavedChanges = true; });
			if (isBuiltIn) text.setDisabled(true);
		});

	new Setting(editSection)
		.setName('显示名称')
		.addText((text) => text
			.setValue(field.name)
			.onChange((value) => { field.name = value; hasUnsavedChanges = true; }));

	new Setting(editSection)
		.setName('字段类型')
		.addDropdown((dropdown) => {
			for (const type of FIELD_TYPES) {
				dropdown.addOption(type, FIELD_TYPE_LABELS[type]);
			}
			dropdown.setValue(field.type).onChange((value) => {
				if (isBuiltIn) return;
				field.type = value as UnifiedFieldType;
				hasUnsavedChanges = true;
				editSection.remove();
				toggleEdit(card, field, fields, manager, container, personRefs, taskRefs);
			});
			if (isBuiltIn) dropdown.setDisabled(true);
		});

	new Setting(editSection)
		.setName('图标')
		.setDesc(field.icon ? `当前：${field.icon}` : '未设置')
		.addButton((button) => button
			.setButtonText('选择图标')
			.setIcon('smile-plus')
			.onClick(() => {
				new TaskMarkerPickerModal(manager.app, field.icon, (icon) => {
					field.icon = icon || 'brackets';
					hasUnsavedChanges = true;
					editSection.remove();
					toggleEdit(card, field, fields, manager, container, personRefs, taskRefs);
				}).open();
			}));

	new Setting(editSection)
		.setName('颜色')
		.addText((text) => {
			text.inputEl.type = 'color';
			text.setValue(field.color).onChange((value) => { field.color = value; hasUnsavedChanges = true; });
		});

	if (field.type === 'single-select' || field.type === 'multi-select') {
		renderOptions(editSection, field, () => {
			editSection.remove();
			toggleEdit(card, field, fields, manager, container, personRefs, taskRefs);
		});
	}

	new Setting(editSection)
		.setName('默认值')
		.addText((text) => text
			.setValue(field.defaultValue !== null && field.defaultValue !== undefined ? String(field.defaultValue) : '')
			.onChange((value) => { field.defaultValue = value || null; hasUnsavedChanges = true; }));
}

function renderOptions(
	container: HTMLElement,
	field: UnifiedMetadataField,
	rerenderFn: () => void,
): void {
	const options = field.options ?? [];
	field.options = options;

	new Setting(container).setName('选项').setDesc('管理可选项的 ID 和显示名称。');

	for (const option of options) {
		new Setting(container)
			.setClass('op-template-option-row')
			.addText((text) => text
				.setPlaceholder('选项 ID')
				.setValue(option.id)
				.onChange((id) => { option.id = id.trim(); hasUnsavedChanges = true; }))
			.addText((text) => text
				.setPlaceholder('显示名称')
				.setValue(option.name)
				.onChange((name) => { option.name = name; hasUnsavedChanges = true; }))
			.addExtraButton((button) => button
				.setIcon('trash-2')
				.setTooltip('删除选项')
				.onClick(() => {
					field.options = options.filter((item) => item !== option);
					hasUnsavedChanges = true;
					rerenderFn();
				}));
	}

	new Setting(container)
		.addButton((button) => button
			.setButtonText('新增选项')
			.setIcon('plus')
			.onClick(() => {
				const index = options.length + 1;
				field.options = [...options, { id: `option-${index}`, name: `选项 ${index}` }];
				hasUnsavedChanges = true;
				rerenderFn();
			}));
}

function confirmDelete(
	field: UnifiedMetadataField,
	fields: UnifiedMetadataField[],
	manager: ProjectManager,
	container: HTMLElement,
): void {
	const projectRefs = manager.projects.flatMap(
		(project) => (project.customFieldRefs ?? [])
			.filter((ref) => ref.unifiedMetadataFieldId === field.id)
			.map((ref) => `项目「${project.name}」${ref.taskTypeIds && ref.taskTypeIds.length > 0 ? '（关联任务类型）' : ''}`),
	);
	const personRefs = (manager.globalConfig.personMetadataRefs ?? [])
		.filter((ref) => ref.unifiedMetadataFieldId === field.id)
		.map((ref) => `人员元数据${ref.sourceProperty ? `（映射属性：${ref.sourceProperty}）` : ''}`);
	const taskRefs = (manager.taskMetadataSettings.customFieldRefs ?? [])
		.filter((ref) => ref.unifiedMetadataFieldId === field.id)
		.map(() => '任务元数据');

	const allRefs = [...projectRefs, ...personRefs, ...taskRefs];

	const modal = new Modal(manager.app);
	modal.setTitle('删除元数据字段');

	const content = modal.contentEl;
	content.createEl('p', { text: `确定要删除元数据字段「${field.name}」吗？` });

	if (allRefs.length > 0) {
		content.createEl('p', { text: '该字段被以下位置引用：' });
		const list = content.createEl('ul');
		for (const ref of allRefs) {
			list.createEl('li', { text: ref });
		}
		content.createEl('p', { text: '删除后这些引用将被移除。' });
	}

	const buttonRow = content.createDiv({ cls: 'op-modal-button-row' });
	const cancelBtn = buttonRow.createEl('button', { text: '取消' });
	cancelBtn.addEventListener('click', () => modal.close());

	const confirmBtn = buttonRow.createEl('button', { cls: 'mod-warning', text: '确认删除' });
	confirmBtn.addEventListener('click', () => {
		modal.close();

		manager.projects = manager.projects.map((project) => ({
			...project,
			customFieldRefs: (project.customFieldRefs ?? []).filter(
				(ref) => ref.unifiedMetadataFieldId !== field.id,
			),
		}));
		manager.globalConfig.personMetadataRefs = (manager.globalConfig.personMetadataRefs ?? [])
			.filter((ref) => ref.unifiedMetadataFieldId !== field.id);
		manager.taskMetadataSettings.customFieldRefs = (manager.taskMetadataSettings.customFieldRefs ?? [])
			.filter((ref) => ref.unifiedMetadataFieldId !== field.id);

		const index = fields.indexOf(field);
		if (index >= 0) fields.splice(index, 1);
		manager.globalConfig.unifiedMetadataFields = fields;

		hasUnsavedChanges = true;
		rerender(container, manager);
	});

	modal.open();
}

/** Re-render without saving - just redraw the current state */
function rerender(container: HTMLElement, manager: ProjectManager): void {
	container.empty();
	renderUnifiedMetadataEditor(container, manager);
}

/** Persist all changes to disk */
async function saveAll(manager: ProjectManager, container: HTMLElement): Promise<void> {
	try {
		await manager.saveUnifiedMetadataFields();
		hasUnsavedChanges = false;
		new Notice('元数据配置已保存。');
		container.empty();
		renderUnifiedMetadataEditor(container, manager);
	} catch (error) {
		new Notice(error instanceof Error ? error.message : String(error));
	}
}

/**
 * 重置元数据配置：将所有内置字段的 color/icon 恢复为 BUILT_IN_FIELD_DEFINITIONS 中的默认值。
 * 不影响自定义字段，不重置 name/key/type。仅修改内存状态并标记 hasUnsavedChanges=true，需用户手动保存。
 */
function resetMetadata(manager: ProjectManager, container: HTMLElement): void {
	const modal = new Modal(manager.app);
	modal.setTitle('重置元数据配置');
	const content = modal.contentEl;
	content.createEl('p', { text: '确定要将所有内置字段的颜色和图标恢复为默认值吗？' });
	content.createEl('p', { text: '此操作不会删除自定义字段，仅重置内置字段的 color/icon。重置后需点击保存按钮持久化。', cls: 'op-modal-hint' });
	const buttonRow = content.createDiv({ cls: 'op-modal-button-row' });
	const cancelBtn = buttonRow.createEl('button', { text: '取消' });
	cancelBtn.addEventListener('click', () => modal.close());
	const confirmBtn = buttonRow.createEl('button', { cls: 'mod-warning', text: '确认重置' });
	confirmBtn.addEventListener('click', () => {
		modal.close();
		const fields = manager.globalConfig.unifiedMetadataFields ?? [];
		const builtInMap = new Map(BUILT_IN_FIELD_DEFINITIONS.map((def) => [def.key, def]));
		for (const field of fields) {
			if (!field.isBuiltIn) continue;
			const def = builtInMap.get(field.key);
			if (!def) continue;
			field.color = def.color;
			field.icon = def.icon;
		}
		manager.globalConfig.unifiedMetadataFields = fields;
		hasUnsavedChanges = true;
		new Notice('已重置内置字段为默认 color/icon，请点击保存按钮持久化。');
		rerender(container, manager);
	});
	modal.open();
}