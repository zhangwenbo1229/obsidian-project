import type { Person, PersonMetadataFieldDefinition } from '../domain/types';
import type { PeopleSourceSettings } from '../services/people-source';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter';

export const DEFAULT_PERSON_DIRECTORY = '项目管理/人员';

export function personMarkdownPath(folder: string, name: string): string {
	const directory = folder.trim().replace(/^\/+|\/+$/gu, '') || DEFAULT_PERSON_DIRECTORY;
	const basename = name.trim()
		.replace(/[\\/:*?"<>|#[\]^]+/gu, ' - ')
		.replace(/\s+/gu, ' ')
		.replace(/^[-.\s]+|[-.\s]+$/gu, '') || '未命名人员';
	return `${directory}/${basename}.md`;
}

export function serializePersonMarkdown(
	person: Person,
	settings: PeopleSourceSettings,
	fields: readonly PersonMetadataFieldDefinition[],
	existingSource?: string,
): string {
	const existing = existingSource === undefined ? null : parseFrontmatter(existingSource);
	const frontmatter = { ...(existing?.frontmatter ?? {}) };
	frontmatter['pm-kind'] = 'person';
	frontmatter['pm-schema'] = 1;
	frontmatter['person-id'] = person.id;
	frontmatter[settings.nameProperty || 'name'] = person.name;
	frontmatter.active = person.active;
	for (const field of fields) {
		const property = field.sourceProperty ?? field.key;
		const value = person.metadata?.[field.key];
		if (value === undefined || value === null || value === '') delete frontmatter[property];
		else frontmatter[property] = value;
	}
	// 也写入 person.metadata 中不在 fields 里的键（来自 personMetadataRefs 的新统一元数据）
	for (const [key, value] of Object.entries(person.metadata ?? {})) {
		if (fields.some((f) => f.key === key)) continue;
		if (value === undefined || value === null || value === '') continue;
		frontmatter[key] = value;
	}
	return serializeFrontmatter(
		frontmatter,
		existing?.body.trim() ? existing.body : `# ${person.name}`,
		existing?.lineEnding ?? '\n',
	);
}
