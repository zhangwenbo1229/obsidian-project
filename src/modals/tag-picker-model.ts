import type { TagGroup } from '../domain/types';
import { rootTagPath } from '../services/tag-group-service';

export interface TagPickerGroup {
	id: string | null;
	name: string;
}

export function availableTagGroups(groups: readonly TagGroup[]): TagPickerGroup[] {
	return [
		{ id: null, name: '未分组' },
		...[...groups]
			.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'zh-CN'))
			.map((group) => ({ id: group.id, name: group.name })),
	];
}

export function groupIdForTag(
	tag: string,
	groups: readonly TagGroup[],
	assignments: Readonly<Record<string, string>>,
): string | null {
	const assigned = assignments[rootTagPath(tag)];
	return assigned && groups.some((group) => group.id === assigned) ? assigned : null;
}

export function filterTagSuggestions(
	tags: readonly string[],
	groups: readonly TagGroup[],
	assignments: Readonly<Record<string, string>>,
	groupId: string | null,
	query: string,
	selectedTags: readonly string[],
): string[] {
	const selected = new Set(selectedTags);
	const needle = query.trim().toLocaleLowerCase('zh-CN');
	return [...new Set(tags)]
		.filter((tag) => !selected.has(tag))
		.filter((tag) => groupIdForTag(tag, groups, assignments) === groupId)
		.filter((tag) => !needle || tag.toLocaleLowerCase('zh-CN').includes(needle))
		.sort((left, right) => left.localeCompare(right, 'zh-CN'))
		.slice(0, 30);
}
