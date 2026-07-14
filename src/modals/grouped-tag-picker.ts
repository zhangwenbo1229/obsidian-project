import type { ProjectManager } from '../services/project-manager';
import { groupTags } from '../services/tag-group-service';

function normalizeTag(value: string): string {
	return value.trim().replace(/^#+/u, '').replace(/^\/+|\/+$/gu, '');
}

export function renderGroupedTagPicker(
	container: HTMLElement,
	manager: ProjectManager,
	selectedTags: readonly string[],
	onChange: (tags: string[]) => void,
): void {
	const selected = new Set(selectedTags);
	const root = container.createDiv({ cls: 'op-grouped-tag-picker' });
	const heading = root.createDiv({ cls: 'op-grouped-tag-picker-heading' });
	heading.createEl('strong', { text: '标签' });
	const choices = root.createDiv({ cls: 'op-grouped-tag-picker-groups' });

	const renderChoices = () => {
		choices.empty();
		const knownTags = [...new Set([
			...manager.index.validTasks().flatMap((task) => task.document.metadata.tags),
			...selected,
		])].sort((left, right) => left.localeCompare(right, 'zh-CN'));
		for (const group of groupTags(knownTags, manager.tagGroups, manager.tagGroupAssignments)) {
			const section = choices.createDiv({ cls: 'op-grouped-tag-picker-group' });
			section.createDiv({ cls: 'op-grouped-tag-picker-group-name', text: group.name });
			const options = section.createDiv({ cls: 'op-grouped-tag-picker-options' });
			for (const tag of group.tags) {
				const label = options.createEl('label', { cls: 'op-grouped-tag-picker-option' });
				const checkbox = label.createEl('input', { type: 'checkbox' });
				checkbox.checked = selected.has(tag);
				label.createSpan({ text: tag });
				checkbox.addEventListener('change', () => {
					if (checkbox.checked) selected.add(tag);
					else selected.delete(tag);
					onChange([...selected]);
				});
			}
		}
	};

	const createRow = root.createDiv({ cls: 'op-grouped-tag-picker-create' });
	const input = createRow.createEl('input', { type: 'text', placeholder: '新建标签' });
	const add = createRow.createEl('button', { text: '添加', attr: { type: 'button' } });
	const addTag = () => {
		const tag = normalizeTag(input.value);
		if (!tag) return;
		selected.add(tag);
		input.value = '';
		onChange([...selected]);
		renderChoices();
	};
	add.addEventListener('click', addTag);
	input.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		addTag();
	});
	renderChoices();
}
