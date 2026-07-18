import type { TagGroup, TagStyle } from '../domain/types';
import { MigrationJournal } from '../repositories/migration-journal';
import { createUuid } from '../utils/ids';
import { moveTagStylePath, renameTagPath, renameTagStyles } from './tag-service';
import { removeTagGroupAssignments, renameTagGroupAssignments, rootTagPath } from './tag-group-service';
import type { ProjectManager } from './project-manager';

export class TagManagerService {
	constructor(private readonly pm: ProjectManager) {}

	async renameTag(oldPath: string, newPath: string): Promise<void> {
		const entries = this.pm.index.validTasks().filter((task) =>
			task.document.metadata.tags.some((tag) => tag === oldPath || tag.startsWith(`${oldPath}/`)),
		);
		const changed = entries.map((entry) => {
			const document = structuredClone(entry.document);
			document.metadata.tags = renameTagPath(document.metadata.tags, oldPath, newPath);
			return document;
		});
		const journal = new MigrationJournal(this.pm.vault, createUuid());
		await journal.create('tag-rename', entries.map((entry, index) => ({
			uid: entry.document.metadata.uid,
			oldPath: entry.path,
			newPath: entry.path,
			oldKey: entry.document.metadata.key,
			newKey: entry.document.metadata.key,
			projectUid: entry.project.uid,
			document: changed[index]!,
			baseline: entry.document,
		})));
		for (const [index, entry] of entries.entries()) {
			await this.pm.taskRepository.save(entry.path, changed[index]!, entry.project, entry.document);
			await journal.complete(entry.document.metadata.uid);
		}
		this.pm.tagOrder = renameTagPath(this.pm.tagOrder, oldPath, newPath);
		this.pm.tagStyles = renameTagStyles(this.pm.tagStyles, oldPath, newPath);
		this.pm.tagGroupAssignments = renameTagGroupAssignments(this.pm.tagGroupAssignments, oldPath, newPath);
		await this.pm.persistConfiguration();
		await this.pm.reload();
	}

	async saveTagOrder(order: readonly string[]): Promise<void> {
		this.pm.tagOrder = [...new Set(order)];
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async saveTagStyle(tagPath: string, style: TagStyle): Promise<void> {
		const normalizedPath = tagPath.trim().replace(/^#|\/$/gu, '');
		if (!normalizedPath) throw new Error('标签路径不能为空。');
		const normalizedStyle = {
			icon: style.icon?.trim() || undefined,
			color: style.color?.trim() || undefined,
		};
		if (!normalizedStyle.icon && !normalizedStyle.color) delete this.pm.tagStyles[normalizedPath];
		else this.pm.tagStyles[normalizedPath] = normalizedStyle;
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async moveTagStyle(oldPath: string, newPath: string): Promise<void> {
		this.pm.tagStyles = moveTagStylePath(this.pm.tagStyles, oldPath, newPath);
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async saveTagGroup(group: TagGroup): Promise<void> {
		const next = { ...structuredClone(group), name: group.name.trim() };
		if (!next.name) throw new Error('标签分组名称不能为空。');
		const index = this.pm.tagGroups.findIndex((item) => item.id === next.id);
		if (index < 0) this.pm.tagGroups.push(next);
		else this.pm.tagGroups[index] = next;
		this.pm.tagGroups = this.pm.tagGroups
			.sort((left, right) => left.order - right.order)
			.map((item, order) => ({ ...item, order }));
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async deleteTagGroup(groupId: string): Promise<void> {
		this.pm.tagGroups = this.pm.tagGroups.filter((group) => group.id !== groupId).map((group, order) => ({ ...group, order }));
		this.pm.tagGroupAssignments = removeTagGroupAssignments(this.pm.tagGroupAssignments, groupId);
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async assignTagGroup(tagPath: string, groupId: string | null): Promise<void> {
		const root = rootTagPath(tagPath);
		if (groupId && !this.pm.tagGroups.some((group) => group.id === groupId)) throw new Error('标签分组不存在。');
		if (groupId) this.pm.tagGroupAssignments[root] = groupId;
		else delete this.pm.tagGroupAssignments[root];
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	orderTags(tags: readonly string[]): string[] {
		const rank = new Map(this.pm.tagOrder.map((tag, index) => [tag, index]));
		return [...tags].sort((left, right) => {
			const leftRank = rank.get(left) ?? Number.MAX_SAFE_INTEGER;
			const rightRank = rank.get(right) ?? Number.MAX_SAFE_INTEGER;
			return leftRank === rightRank ? left.localeCompare(right, 'zh-CN') : leftRank - rightRank;
		});
	}
}
