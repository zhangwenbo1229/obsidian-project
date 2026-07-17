import { Modal, Notice, Setting } from 'obsidian';
import type { Person, PersonMetadataFieldDefinition } from '../domain/types';
import type { ProjectManager } from '../services/project-manager';
import { normalizePersonMetadataValue } from '../services/person-metadata';
import { createUuid } from '../utils/ids';
import { applyFieldPresentation } from '../views/field-presentation';

export class PersonModal extends Modal {
	private value: Person;

	constructor(
		private readonly manager: ProjectManager,
		person?: Person,
		private readonly onSaved?: () => void,
	) {
		super(manager.app);
		this.value = structuredClone(person ?? { id: createUuid(), name: '', active: true, metadata: {} });
		this.value.metadata ??= {};
	}

	onOpen(): void {
		this.setTitle(this.manager.globalConfig.people.some((person) => person.id === this.value.id) ? '编辑人员' : '新增人员');
		this.contentEl.addClass('op-person-dialog');
		new Setting(this.contentEl).setName('姓名').addText((text) => text
			.setPlaceholder('输入人员姓名').setValue(this.value.name).onChange((name) => (this.value.name = name)));
		new Setting(this.contentEl).setName('启用').addToggle((toggle) => toggle
			.setValue(this.value.active).onChange((active) => (this.value.active = active)));
		for (const field of this.manager.globalConfig.personMetadataFields.filter((item) => item.active)) this.renderMetadataField(field);
		new Setting(this.contentEl).addButton((button) => button.setButtonText('保存人员').setCta().onClick(() => void this.save()));
	}

	private renderMetadataField(field: PersonMetadataFieldDefinition): void {
		const setting = new Setting(this.contentEl).setName(field.title).setDesc(field.sourceProperty ? `来源属性：${field.sourceProperty}` : field.key);
		applyFieldPresentation(setting, field);
		const current = this.value.metadata?.[field.key];
		const update = (value: unknown) => {
			this.value.metadata ??= {};
			if (value === undefined || value === '') delete this.value.metadata[field.key];
			else this.value.metadata[field.key] = value;
		};
		if (field.type === 'multiline-text') {
			setting.addTextArea((area) => area.setValue(typeof current === 'string' ? current : '').onChange(update));
		} else if (field.type === 'number') {
			setting.addText((text) => {
				text.inputEl.type = 'number';
				text.setValue(typeof current === 'number' ? String(current) : '').onChange((value) => update(value === '' ? undefined : Number(value)));
			});
		} else if (field.type === 'boolean') {
			setting.addToggle((toggle) => toggle.setValue(current === true).onChange(update));
		} else if (field.type === 'date' || field.type === 'datetime') {
			setting.addText((text) => {
				text.inputEl.type = field.type === 'date' ? 'date' : 'datetime-local';
				text.setValue(typeof current === 'string' ? current.slice(0, field.type === 'date' ? 10 : 16) : '').onChange(update);
			});
		} else if (field.type === 'single-select') {
			setting.addDropdown((dropdown) => {
				dropdown.addOption('', '未设置');
				for (const option of field.options ?? []) dropdown.addOption(option.id, option.name);
				dropdown.setValue(typeof current === 'string' ? current : '').onChange(update);
			});
		} else if (field.type === 'multi-select') {
			const selected = new Set(Array.isArray(current) ? current.map(String) : []);
			const options = setting.controlEl.createDiv({ cls: 'op-person-metadata-multi-select' });
			for (const option of field.options ?? []) {
				const label = options.createEl('label');
				const checkbox = label.createEl('input', { type: 'checkbox' });
				checkbox.checked = selected.has(option.id);
				label.createSpan({ text: option.name });
				checkbox.addEventListener('change', () => {
					if (checkbox.checked) selected.add(option.id); else selected.delete(option.id);
					update([...selected]);
				});
			}
		} else {
			setting.addText((text) => text.setValue(typeof current === 'string' ? current : '').onChange(update));
		}
	}

	private async save(): Promise<void> {
		try {
			const metadata = Object.fromEntries(this.manager.globalConfig.personMetadataFields.flatMap((field) => {
				const value = normalizePersonMetadataValue(field, this.value.metadata?.[field.key]);
				return value === undefined ? [] : [[field.key, value]];
			}));
			await this.manager.savePerson({ ...this.value, name: this.value.name.trim(), metadata });
			this.close();
			this.onSaved?.();
		} catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
	}
}
