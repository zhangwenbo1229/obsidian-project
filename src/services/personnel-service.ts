import type { Person, PersonMetadataFieldDefinition, PersonNamePresentation } from '../domain/types';
import { normalizePersonMetadataValue, normalizePersonMetadataFields, normalizePersonNamePresentation } from './person-metadata';
import { collectPeopleFromMetadata, normalizePeopleSourceSettings, reconcileSourcedPeople, type PeopleSourceSettings } from './people-source';
import { DEFAULT_PERSON_DIRECTORY, personMarkdownPath, serializePersonMarkdown } from '../markdown/person-parser';
import { personDeletionBlockReason } from './person-deletion';
import type { ProjectManager } from './project-manager';

export class PersonnelService {
	constructor(private readonly pm: ProjectManager) {}

	async savePeopleSourceSettings(settings: PeopleSourceSettings): Promise<void> {
		this.pm.peopleSourceSettings = normalizePeopleSourceSettings(settings);
		await this.refreshPeopleFromMetadata();
	}

	async refreshPeopleFromMetadata(preferred?: Person): Promise<void> {
		let sourced = collectPeopleFromMetadata(this.pm.app.vault.getMarkdownFiles().map((file) => ({
			path: file.path,
			basename: file.basename,
			frontmatter: this.pm.app.metadataCache.getFileCache(file)?.frontmatter,
		})), this.pm.peopleSourceSettings, this.pm.globalConfig.personMetadataFields);
		if (preferred?.sourcePath) {
			sourced = [...sourced.filter((person) => person.sourcePath !== preferred.sourcePath), preferred];
		}
		this.pm.globalConfig.people = reconcileSourcedPeople(
			this.pm.globalConfig.people,
			sourced,
			this.pm.globalConfig.currentUserId,
		);
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async savePerson(person: Person): Promise<void> {
		const name = person.name.trim();
		if (!name) throw new Error('人员姓名不能为空。');
		const metadata = (() => {
			const entries = new Map<string, unknown>();
			// 旧版 personMetadataFields
			for (const field of this.pm.globalConfig.personMetadataFields) {
				const value = normalizePersonMetadataValue(field, person.metadata?.[field.key]);
				if (value !== undefined) entries.set(field.key, value);
			}
			// 新版 personMetadataRefs → 统一元数据字段池
			const pool = this.pm.globalConfig.unifiedMetadataFields ?? [];
			const unifiedById = new Map(pool.map((f) => [f.id, f]));
			const refs = this.pm.globalConfig.personMetadataRefs ?? [];
			for (const ref of refs) {
				const unified = unifiedById.get(ref.unifiedMetadataFieldId);
				if (!unified) continue;
				const value = person.metadata?.[unified.key];
				if (value !== undefined || value !== null || value !== '') {
					entries.set(unified.key, value);
				}
			}
			return Object.fromEntries(entries);
		})();
		const folder = this.pm.peopleSourceSettings.folder || DEFAULT_PERSON_DIRECTORY;
		let sourcePath = person.sourcePath ?? personMarkdownPath(folder, name);
		if (!person.sourcePath && await this.pm.vault.exists(sourcePath)) {
			sourcePath = personMarkdownPath(folder, `${name} ${person.id.slice(0, 8)}`);
		}
		const next = { ...structuredClone(person), name, metadata, sourcePath };
		await this.pm.vault.ensureFolder(sourcePath.split('/').slice(0, -1).join('/'));
		if (await this.pm.vault.exists(sourcePath)) {
			await this.pm.vault.process(sourcePath, (source) => serializePersonMarkdown(
				next, this.pm.peopleSourceSettings, this.pm.globalConfig.personMetadataFields, source,
			));
		} else {
			await this.pm.vault.create(sourcePath, serializePersonMarkdown(
				next, this.pm.peopleSourceSettings, this.pm.globalConfig.personMetadataFields,
			));
		}
		if (!(await this.pm.vault.exists(sourcePath))) throw new Error(`人员文件写入失败：${sourcePath}`);
		const index = this.pm.globalConfig.people.findIndex((item) => item.id === next.id);
		if (index < 0) this.pm.globalConfig.people.push(next);
		else this.pm.globalConfig.people[index] = next;
		if (this.pm.peopleSourceSettings.enabled) await this.pm.refreshPeopleFromMetadata(next);
		else {
			await this.pm.persistConfiguration();
			this.pm.notifyListeners();
		}
	}

	async deletePerson(personId: string): Promise<void> {
		const person = this.pm.globalConfig.people.find((item) => item.id === personId);
		if (!person) throw new Error('人员不存在或已被删除。');
		const blockReason = personDeletionBlockReason(
			personId,
			this.pm.globalConfig.currentUserId,
			this.pm.index.validTasks().map((task) => task.document),
		);
		if (blockReason) throw new Error(blockReason);
		if (person.sourcePath && await this.pm.vault.exists(person.sourcePath)) {
			await this.pm.vault.trash(person.sourcePath);
		}
		this.pm.globalConfig.people = this.pm.globalConfig.people.filter((item) => item.id !== personId);
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async savePersonNamePresentation(presentation: PersonNamePresentation): Promise<void> {
		this.pm.globalConfig.personNamePresentation = normalizePersonNamePresentation(presentation);
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}

	async savePersonMetadataFields(fields: readonly PersonMetadataFieldDefinition[]): Promise<void> {
		const normalized = normalizePersonMetadataFields(fields);
		const previousById = new Map(this.pm.globalConfig.personMetadataFields.map((field) => [field.id, field]));
		for (const field of normalized) {
			const previous = previousById.get(field.id);
			if (!previous || previous.key === field.key) continue;
			for (const person of this.pm.globalConfig.people) {
				if (!person.metadata || person.metadata[previous.key] === undefined || person.metadata[field.key] !== undefined) continue;
				person.metadata[field.key] = person.metadata[previous.key];
				delete person.metadata[previous.key];
			}
		}
		this.pm.globalConfig.personMetadataFields = normalized;
		await this.pm.persistConfiguration();
		this.pm.notifyListeners();
	}
}
