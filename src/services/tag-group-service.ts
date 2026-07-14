import type { TagGroup } from '../domain/types';

export interface GroupedTags {
	groupId: string | null;
	name: string;
	tags: string[];
}

export function rootTagPath(tagPath: string): string {
	return tagPath.split('/').filter(Boolean)[0] ?? tagPath;
}

export function groupTags(
	tags: readonly string[],
	groups: readonly TagGroup[],
	assignments: Readonly<Record<string, string>>,
): GroupedTags[] {
	const sortedGroups = [...groups].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'zh-CN'));
	const tagsByGroup = new Map<string | null, string[]>(sortedGroups.map((group) => [group.id, []]));
	tagsByGroup.set(null, []);
	const validGroupIds = new Set(sortedGroups.map((group) => group.id));
	for (const tag of tags) {
		const assigned = assignments[rootTagPath(tag)];
		const groupId = assigned && validGroupIds.has(assigned) ? assigned : null;
		tagsByGroup.get(groupId)!.push(tag);
	}
	return [
		...sortedGroups.map((group) => ({ groupId: group.id, name: group.name, tags: tagsByGroup.get(group.id)! })),
		{ groupId: null, name: '未分组', tags: tagsByGroup.get(null)! },
	].filter((group) => group.tags.length > 0);
}

export function renameTagGroupAssignments(
	assignments: Readonly<Record<string, string>>,
	oldPath: string,
	newPath: string,
): Record<string, string> {
	const next = { ...assignments };
	const oldRoot = rootTagPath(oldPath);
	const newRoot = rootTagPath(newPath);
	if (oldRoot !== newRoot && next[oldRoot]) {
		next[newRoot] = next[oldRoot];
		delete next[oldRoot];
	}
	return next;
}

export function removeTagGroupAssignments(
	assignments: Readonly<Record<string, string>>,
	groupId: string,
): Record<string, string> {
	return Object.fromEntries(Object.entries(assignments).filter(([, assignedGroupId]) => assignedGroupId !== groupId));
}
