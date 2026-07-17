import type { Person, PersonMetadataFieldDefinition } from '../domain/types';
import { normalizePersonMetadataValue } from './person-metadata';

export interface PeopleSourceSettings {
	enabled: boolean;
	folder: string;
	nameProperty: string;
}

export interface PeopleMetadataFile {
	path: string;
	basename: string;
	frontmatter?: Record<string, unknown>;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

export function normalizePeopleSourceSettings(value?: unknown): PeopleSourceSettings {
	const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
	return {
		enabled: source.enabled === true,
		folder: text(source.folder).replace(/^\/+|\/+$/gu, ''),
		nameProperty: text(source.nameProperty) || 'name',
	};
}

function inFolder(path: string, folder: string): boolean {
	return !folder || path.startsWith(`${folder}/`);
}

function stablePersonId(path: string): string {
	let first = 0x811c9dc5;
	let second = 0x9e3779b9;
	for (const character of path) {
		first = Math.imul(first ^ character.charCodeAt(0), 0x01000193) >>> 0;
		second = Math.imul(second ^ character.charCodeAt(0), 0x85ebca6b) >>> 0;
	}
	const parts = [first, second, first ^ second, Math.imul(first, second)].map((value) => (value >>> 0).toString(16).padStart(8, '0'));
	const hex = parts.join('').slice(0, 32);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function persistedPersonId(value: unknown): string | null {
	const id = text(value).toLowerCase();
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id) ? id : null;
}

export function collectPeopleFromMetadata(
	files: readonly PeopleMetadataFile[],
	settings: PeopleSourceSettings,
	fields: readonly PersonMetadataFieldDefinition[] = [],
): Person[] {
	if (!settings.enabled) return [];
	return files.flatMap((file) => {
		if (!inFolder(file.path, settings.folder)) return [];
		const metadata = file.frontmatter ?? {};
		const name = text(metadata[settings.nameProperty]) || file.basename;
		if (!name) return [];
		const personMetadata = Object.fromEntries(fields.flatMap((field) => {
			const value = normalizePersonMetadataValue(field, metadata[field.sourceProperty ?? field.key]);
			return value === undefined ? [] : [[field.key, value]];
		}));
		return [{
			id: persistedPersonId(metadata['person-id']) ?? stablePersonId(file.path),
			name,
			active: true,
			sourcePath: file.path,
			metadata: personMetadata,
		}];
	});
}

export function reconcileSourcedPeople(
	existing: readonly Person[],
	sourced: readonly Person[],
	currentUserId: string,
): Person[] {
	const refreshedPaths = new Set(sourced.map((person) => person.sourcePath).filter((path): path is string => Boolean(path)));
	return [
		...existing.filter((person) => !person.sourcePath || (person.id === currentUserId && !refreshedPaths.has(person.sourcePath))),
		...sourced,
	];
}
