import { Notice, Setting } from 'obsidian';
import type { PersonMetadataFieldDefinition, PersonMetadataFieldType, PersonNamePresentation } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { PERSON_METADATA_FIELD_TYPES, normalizePersonMetadataFields, normalizePersonNamePresentation } from '../services/person-metadata';
import { createUuid } from '../utils/ids';

const TYPE_LABELS: Record<PersonMetadataFieldType, string> = {
	text: '文本', 'multiline-text': '多行文本', number: '数字', boolean: '布尔', date: '日期', datetime: '日期时间',
	'single-select': '单选', 'multi-select': '多选',
};

export class PersonMetadataSettingsEditor {
	private fields: PersonMetadataFieldDefinition[];
	private namePresentation: PersonNamePresentation;
	private root: HTMLElement | null = null;

	constructor(private readonly manager: ProjectManager) {
		this.fields = structuredClone(manager.globalConfig.personMetadataFields);
		this.namePresentation = normalizePersonNamePresentation(manager.globalConfig.personNamePresentation);
	}

	mount(container: HTMLElement): void { this.root = container; this.render(); }

	private render(): void {
		if (!this.root) return;
		this.root.empty();
		const nameCard = this.root.createDiv({ cls: 'op-person-metadata-field op-person-name-presentation' });
		new Setting(nameCard).setName('人员名称属性').setDesc('控制 Markdown 中 @人员引用的标题、图标和名称颜色。').setHeading();
		new Setting(nameCard).setName('显示标题').addText((text) => text
			.setValue(this.namePresentation.title).onChange((title) => (this.namePresentation.title = title)));
		new Setting(nameCard).setName('名称图标').addText((text) => text
			.setPlaceholder('图标名称或 emoji').setValue(this.namePresentation.icon ?? '')
			.onChange((icon) => (this.namePresentation.icon = icon.trim() || undefined)));
		new Setting(nameCard).setName('名称颜色').addColorPicker((picker) => picker
			.setValue(this.namePresentation.color ?? '#0c66e4').onChange((color) => (this.namePresentation.color = color)));
		const heading = new Setting(this.root).setName('人员元数据').setDesc('定义所有人员共享的元数据字段、类型和显示样式。').setHeading();
		heading.addButton((button) => button.setButtonText('新增元数据').setCta().onClick(() => {
			const number = this.fields.length + 1;
			this.fields.push({ id: createUuid(), key: `person_field_${number}`, title: `人员字段 ${number}`, type: 'text', active: true });
			this.render();
		}));
		for (const field of this.fields) this.renderField(field);
		new Setting(this.root).addButton((button) => button.setButtonText('保存元数据配置').setCta().onClick(() => void this.save()));
	}

	private renderField(field: PersonMetadataFieldDefinition): void {
		if (!this.root) return;
		const card = this.root.createDiv({ cls: 'op-person-metadata-field' });
		new Setting(card).setName(field.title || field.key)
			.addToggle((toggle) => toggle.setTooltip('启用').setValue(field.active).onChange((active) => (field.active = active)))
			.addExtraButton((button) => button.setIcon('trash-2').setTooltip('删除元数据').onClick(() => {
				this.fields = this.fields.filter((item) => item.id !== field.id); this.render();
			}));
		new Setting(card).setName('元数据标题').addText((text) => text.setValue(field.title).onChange((title) => (field.title = title)));
		new Setting(card).setName('字段键').addText((text) => text.setValue(field.key).onChange((key) => (field.key = key)));
		new Setting(card).setName('文件属性名').setDesc('留空时使用字段键。').addText((text) => text.setValue(field.sourceProperty ?? '').onChange((value) => (field.sourceProperty = value.trim() || undefined)));
		new Setting(card).setName('字段类型').addDropdown((dropdown) => {
			for (const type of PERSON_METADATA_FIELD_TYPES) dropdown.addOption(type, TYPE_LABELS[type]);
			dropdown.setValue(field.type).onChange((type) => { field.type = type as PersonMetadataFieldType; this.render(); });
		});
		new Setting(card).setName('元数据图标').addText((text) => text.setValue(field.icon ?? '').onChange((icon) => (field.icon = icon.trim() || undefined)));
		new Setting(card).setName('元数据颜色').addColorPicker((picker) => picker.setValue(field.color ?? '#626f86').onChange((color) => (field.color = color)));
		if (field.type === 'single-select' || field.type === 'multi-select') {
			new Setting(card).setName('选项').setDesc('使用逗号分隔。').addText((text) => text
				.setValue((field.options ?? []).map((option) => option.name).join(', '))
				.onChange((value) => (field.options = value.split(/[,，]/u).map((name) => name.trim()).filter(Boolean).map((name) => ({ id: name, name })))));
		}
	}

	private async save(): Promise<void> {
		try {
			await this.manager.savePersonNamePresentation(normalizePersonNamePresentation(this.namePresentation));
			await this.manager.savePersonMetadataFields(normalizePersonMetadataFields(this.fields));
			this.fields = structuredClone(this.manager.globalConfig.personMetadataFields);
			this.namePresentation = normalizePersonNamePresentation(this.manager.globalConfig.personNamePresentation);
			new Notice('人员元数据配置已保存。');
			this.render();
		} catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}
}
