import { setIcon, Setting } from 'obsidian';
import type { CustomFieldDefinition, TaskDisplayField } from '../domain/types';
import { reorderTaskDisplayFields } from '../views/display-field-order';
import { taskDisplayFieldCatalog, taskDisplayFieldLabel } from '../views/task-display-settings';

export class SortableDisplayFields {
	private fields: TaskDisplayField[];

	constructor(
		fields: readonly TaskDisplayField[],
		private readonly onChange: (fields: TaskDisplayField[]) => void,
		private readonly customFields: readonly Pick<CustomFieldDefinition, 'key' | 'name'>[] = [],
	) {
		this.fields = [...fields];
	}

	mount(container: HTMLElement): void {
		container.empty();
		const list = container.createDiv({ cls: 'op-sortable-field-list' });
		for (const field of this.fields) {
			const row = list.createDiv({ cls: 'op-sortable-field-row' });
			row.draggable = true;
			row.dataset.field = field;
			const grip = row.createSpan({ cls: 'op-sortable-field-grip' });
			setIcon(grip, 'grip-vertical');
			const label = taskDisplayFieldLabel(field, this.customFields);
			row.createSpan({ cls: 'op-sortable-field-label', text: label });
			const remove = row.createEl('button', { cls: 'op-icon-button', attr: { 'aria-label': `隐藏${label}`, title: '隐藏字段' } });
			setIcon(remove, 'x');
			remove.addEventListener('click', () => this.update(this.fields.filter((item) => item !== field), container));
			row.addEventListener('dragstart', (event) => event.dataTransfer?.setData('text/plain', field));
			row.addEventListener('dragover', (event) => event.preventDefault());
			row.addEventListener('drop', (event) => {
				event.preventDefault();
				const dragged = event.dataTransfer?.getData('text/plain') as TaskDisplayField | undefined;
				if (!dragged) return;
				this.update(reorderTaskDisplayFields(this.fields, dragged, field), container);
			});
		}
		const available = taskDisplayFieldCatalog(this.customFields).filter((field) => !this.fields.includes(field.id));
		if (available.length > 0) {
			let selected = available[0]!.id;
			new Setting(container)
				.setName('添加显示字段')
				.addDropdown((dropdown) => {
					for (const field of available) dropdown.addOption(field.id, field.label);
					dropdown.setValue(selected).onChange((value) => (selected = value as TaskDisplayField));
				})
				.addButton((button) => button.setButtonText('添加').onClick(() => this.update([...this.fields, selected], container)));
		}
	}

	private update(fields: TaskDisplayField[], container: HTMLElement): void {
		this.fields = [...fields];
		this.onChange([...fields]);
		this.mount(container);
	}
}
