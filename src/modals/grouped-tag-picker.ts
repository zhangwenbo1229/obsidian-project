import type { ProjectManager } from '../services/project-manager';
import type { FieldPresentation } from '../views/field-presentation';
import { applyLabelPresentation } from '../views/field-presentation';
import { availableTagGroups, filterTagSuggestions } from './tag-picker-model';

function normalizeTag(value: string): string {
	return value.trim().replace(/^#+/u, '').replace(/^\/+|\/+$/gu, '');
}

export function renderGroupedTagPicker(
	container: HTMLElement,
	manager: ProjectManager,
	selectedTags: readonly string[],
	onChange: (tags: string[]) => void,
	presentation?: FieldPresentation,
): void {
	const selected = new Set(selectedTags);
	let selectedGroupId: string | null = null;
	let highlighted = 0;
	const root = container.createDiv({ cls: 'op-grouped-tag-picker' });
	const heading = root.createDiv({ cls: 'op-grouped-tag-picker-heading' });
	const title = heading.createEl('strong', { text: '标签' });
	applyLabelPresentation(title, presentation);
	const workspace = root.createDiv({ cls: 'op-grouped-tag-picker-workspace' });
	const groupRail = workspace.createDiv({ cls: 'op-grouped-tag-picker-groups', attr: { 'aria-label': '标签分组' } });
	groupRail.createEl('label', { cls: 'op-grouped-tag-picker-group-label', text: '标签分组' });
	const groupSelect = groupRail.createEl('select', {
		cls: 'op-grouped-tag-picker-group-select',
		attr: { 'aria-label': '选择标签分组' },
	});
	for (const group of availableTagGroups(manager.tagGroups)) {
		const option = groupSelect.createEl('option', { text: group.name });
		option.value = group.id ?? '';
	}
	groupSelect.value = '';
	const searchArea = workspace.createDiv({ cls: 'op-grouped-tag-picker-search' });
	const selectedArea = searchArea.createDiv({ cls: 'op-grouped-tag-picker-selected' });
	const input = searchArea.createEl('input', {
		type: 'search',
		placeholder: '输入标签名称',
		attr: { 'aria-label': '搜索或新建标签', autocomplete: 'off' },
	});
	const suggestions = searchArea.createDiv({ cls: 'op-grouped-tag-picker-suggestions', attr: { role: 'listbox' } });

	const knownTags = () => [...new Set([
		...manager.index.validTasks().flatMap((task) => task.document.metadata.tags),
		...selected,
	])];
	const emit = () => onChange(manager.orderTags([...selected]));
	const renderSelected = () => {
		selectedArea.empty();
		for (const tag of manager.orderTags([...selected])) {
			const chip = selectedArea.createEl('button', {
				cls: 'op-grouped-tag-picker-chip', text: tag,
				attr: { type: 'button', title: `移除 ${tag}`, 'aria-label': `移除标签 ${tag}` },
			});
			chip.addEventListener('click', () => {
				selected.delete(tag);
				emit();
				renderSelected();
				renderSuggestions();
			});
		}
	};
	const choose = (tag: string) => {
		selected.add(tag);
		input.value = '';
		highlighted = 0;
		emit();
		renderSelected();
		renderSuggestions();
	};
	const createTag = async () => {
		const tag = normalizeTag(input.value);
		if (!tag) return;
		if (selectedGroupId) await manager.assignTagGroup(tag, selectedGroupId);
		choose(tag);
	};
	const renderSuggestions = () => {
		suggestions.empty();
		const query = input.value.trim();
		suggestions.classList.toggle('is-visible', Boolean(query));
		if (!query) return;
		const matches = filterTagSuggestions(
			knownTags(), manager.tagGroups, manager.tagGroupAssignments, selectedGroupId, query, [...selected],
		);
		highlighted = Math.min(highlighted, Math.max(0, matches.length - 1));
		for (const [index, tag] of matches.entries()) {
			const option = suggestions.createEl('button', {
				cls: `op-grouped-tag-picker-suggestion${index === highlighted ? ' is-highlighted' : ''}`,
				text: tag,
				attr: { type: 'button', role: 'option', 'aria-selected': String(index === highlighted) },
			});
			option.addEventListener('mousedown', (event) => event.preventDefault());
			option.addEventListener('click', () => choose(tag));
		}
		const candidate = normalizeTag(input.value);
		if (candidate && !knownTags().includes(candidate) && !selected.has(candidate)) {
			const create = suggestions.createEl('button', {
				cls: 'op-grouped-tag-picker-suggestion is-create',
				text: `新建“${candidate}”`, attr: { type: 'button' },
			});
			create.addEventListener('mousedown', (event) => event.preventDefault());
			create.addEventListener('click', () => void createTag());
		}
	};
	groupSelect.addEventListener('change', () => {
		selectedGroupId = groupSelect.value || null;
		highlighted = 0;
		renderSuggestions();
		input.focus();
	});
	input.addEventListener('input', () => { highlighted = 0; renderSuggestions(); });
	input.addEventListener('keydown', (event) => {
		const matches = filterTagSuggestions(
			knownTags(), manager.tagGroups, manager.tagGroupAssignments, selectedGroupId, input.value, [...selected],
		);
		if (event.key === 'ArrowDown' && matches.length) {
			event.preventDefault(); highlighted = Math.min(matches.length - 1, highlighted + 1); renderSuggestions();
		} else if (event.key === 'ArrowUp' && matches.length) {
			event.preventDefault(); highlighted = Math.max(0, highlighted - 1); renderSuggestions();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const match = matches[highlighted];
			if (match) choose(match);
			else void createTag();
		} else if (event.key === 'Escape') {
			input.value = ''; highlighted = 0; renderSuggestions();
		}
	});
	renderSelected();
	renderSuggestions();
}
