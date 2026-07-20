import { Modal, Notice, Setting } from 'obsidian';
import type { PersonNamePresentation, PersonMetadataRef } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { normalizePersonNamePresentation } from '../services/person-metadata';
import { TaskMarkerPickerModal } from '../modals/task-marker-picker-modal';

const FIELD_TYPE_LABELS: Record<string, string> = {
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

export function attachDragHandlers<T>(
	card: HTMLElement,
	index: number,
	getList: () => T[],
	rerender: () => void,
): void {
	card.addEventListener('dragstart', (event) => {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', String(index));
		card.addClass('is-dragging');
	});
	card.addEventListener('dragover', (event) => {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		card.addClass('is-drag-over');
	});
	card.addEventListener('dragleave', () => card.removeClass('is-drag-over'));
	card.addEventListener('drop', (event) => {
		event.preventDefault();
		card.removeClass('is-drag-over');
		if (!event.dataTransfer) return;
		const from = parseInt(event.dataTransfer.getData('text/plain'), 10);
		if (Number.isNaN(from) || from === index) return;
		const list = getList();
		const [moved] = list.splice(from, 1);
		if (moved !== undefined) list.splice(index, 0, moved);
		rerender();
	});
	card.addEventListener('dragend', () => {
		card.removeClass('is-dragging');
		card.removeClass('is-drag-over');
	});
}

export class PersonMetadataSettingsEditor {
	private namePresentation: PersonNamePresentation;
	private refs: PersonMetadataRef[];
	private root: HTMLElement | null = null;

	constructor(private readonly manager: ProjectManager) {
		this.namePresentation = normalizePersonNamePresentation(manager.globalConfig.personNamePresentation);
		this.refs = structuredClone(manager.globalConfig.personMetadataRefs ?? []);
	}

	mount(container: HTMLElement): void { this.root = container; this.render(); }

	private render(): void {
		if (!this.root) return;
		this.root.empty();
		const nameCard = this.root.createDiv({ cls: 'op-person-metadata-field op-person-name-presentation' });
		new Setting(nameCard).setName('人员名称属性').setDesc('引用统一元数据字段池中的字段，控制 Markdown 中 @人员引用的标题、图标和名称颜色。').setHeading();

		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		const selectedField = pool.find((f) => f.id === this.namePresentation.unifiedMetadataFieldId);
		new Setting(nameCard)
			.setName('引用元数据字段')
			.setDesc(selectedField
				? `当前：${selectedField.name}（${selectedField.key}）`
				: '未选择，使用默认标题、图标和颜色。')
			.addDropdown((dropdown) => {
				dropdown.addOption('', '-- 不使用引用 --');
				for (const field of pool) {
					dropdown.addOption(field.id, `${field.name}（${field.key}）`);
				}
				dropdown.setValue(this.namePresentation.unifiedMetadataFieldId ?? '')
					.onChange((value) => {
						this.namePresentation.unifiedMetadataFieldId = value || undefined;
						this.render();
					});
			});

		if (!selectedField) {
			new Setting(nameCard).setName('显示标题').addText((text) => text
				.setValue(this.namePresentation.title).onChange((title) => (this.namePresentation.title = title)));
			new Setting(nameCard).setName('名称图标').setDesc(this.namePresentation.icon ? `当前：${this.namePresentation.icon}` : '未设置')
				.addButton((button) => button.setButtonText('选择图标').setIcon('smile-plus').onClick(() => {
					new TaskMarkerPickerModal(this.manager.app, this.namePresentation.icon ?? '', (icon) => {
						this.namePresentation.icon = icon || undefined;
						this.render();
					}).open();
				}));
			new Setting(nameCard).setName('名称颜色').addColorPicker((picker) => picker
				.setValue(this.namePresentation.color ?? '#0c66e4').onChange((color) => (this.namePresentation.color = color)));
		}

		const heading = new Setting(this.root).setName('人员元数据').setDesc('引用统一元数据字段池，定义所有人员共享的元数据字段。').setHeading();
		heading.addButton((button) => button.setButtonText('添加人员元数据').setCta().onClick(() => {
			this.addRef();
		}));

		for (const [index, ref] of this.refs.entries()) this.renderRef(ref, index);
		new Setting(this.root).addButton((button) => button.setButtonText('保存元数据配置').setCta().onClick(() => void this.save()));
	}

	private addRef(): void {
		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		if (pool.length === 0) {
			new Notice('暂无可用元数据字段，请先在「元数据管理」页面创建统一元数据字段。');
			return;
		}
		const existingIds = new Set(this.refs.map((ref) => ref.unifiedMetadataFieldId));
		const available = pool.filter((field) => !existingIds.has(field.id));
		if (available.length === 0) {
			new Notice('所有元数据字段已被引用。');
			return;
		}
		const modal = new Modal(this.manager.app);
		modal.setTitle('添加人员元数据');
		const list = modal.contentEl.createDiv({ cls: 'op-unified-field-picker' });
		for (const field of available) {
			const row = list.createEl('button', { cls: 'op-unified-field-picker-item' });
			row.createSpan({ text: `${field.name}（${field.key}）` });
			row.createSpan({ cls: 'op-unified-field-picker-type', text: FIELD_TYPE_LABELS[field.type] ?? field.type });
			row.addEventListener('click', () => {
				this.refs.push({ unifiedMetadataFieldId: field.id, sourceProperty: field.key });
				modal.close();
				this.render();
			});
		}
		modal.open();
	}

	private renderRef(ref: PersonMetadataRef, index: number): void {
		if (!this.root) return;
		const pool = this.manager.globalConfig.unifiedMetadataFields ?? [];
		const field = pool.find((f) => f.id === ref.unifiedMetadataFieldId);
		if (!field) {
			const card = this.root.createDiv({ cls: 'op-person-metadata-field', attr: { draggable: 'true', 'data-index': String(index) } });
			attachDragHandlers(card, index, () => this.refs, () => this.render());
			new Setting(card)
				.setName('（已删除的元数据字段）')
				.setDesc('该元数据字段已从统一池中移除。')
				.addExtraButton((button) => button.setIcon('trash-2').setTooltip('移除此引用').onClick(() => {
					this.refs = this.refs.filter((r) => r !== ref);
					this.render();
				}));
			return;
		}

		const card = this.root.createDiv({ cls: 'op-person-metadata-field', attr: { draggable: 'true', 'data-index': String(index) } });
		attachDragHandlers(card, index, () => this.refs, () => this.render());
		new Setting(card)
			.setName(field.name)
			.setDesc(`键：${field.key} · 类型：${FIELD_TYPE_LABELS[field.type] ?? field.type}${field.icon ? ` · 图标：${field.icon}` : ''}`)
			.addExtraButton((button) => button.setIcon('grip-vertical').setTooltip('拖拽排序').setDisabled(true))
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('移除此人员元数据引用').onClick(() => {
				this.refs = this.refs.filter((r) => r !== ref);
				this.render();
			}));

		// Show field info from unified pool
		new Setting(card)
			.setName('字段信息')
			.setDesc(`类型：${FIELD_TYPE_LABELS[field.type] ?? field.type} · 颜色：${field.color}${field.required ? ' · 必填' : ''}`);

	}

	private async save(): Promise<void> {
		try {
			await this.manager.savePersonNamePresentation(normalizePersonNamePresentation(this.namePresentation));
			this.manager.globalConfig.personMetadataRefs = this.refs;
			await this.manager.saveGlobalConfig();
			this.namePresentation = normalizePersonNamePresentation(this.manager.globalConfig.personNamePresentation);
			this.refs = structuredClone(this.manager.globalConfig.personMetadataRefs ?? []);
			new Notice('人员元数据配置已保存。');
			this.render();
		} catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}
}