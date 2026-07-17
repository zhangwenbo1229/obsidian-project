import { describe, expect, it } from 'vitest';
import { collectPeopleFromMetadata, normalizePeopleSourceSettings, reconcileSourcedPeople } from '../../src/services/people-source';
import { normalizePersonMetadataFields } from '../../src/services/person-metadata';

describe('people metadata source', () => {
	it('normalizes folder and configurable metadata keys', () => {
		expect(normalizePeopleSourceSettings({
			enabled: true, folder: '/People/', nameProperty: ' display-name ',
		})).toEqual({ enabled: true, folder: 'People', nameProperty: 'display-name' });
	});

	it('collects typed person metadata from Markdown frontmatter under the configured folder', () => {
		const fields = normalizePersonMetadataFields([
			{ id: 'role', key: 'role', title: '岗位', type: 'text', active: true, icon: 'badge', color: '#0052cc' },
			{ id: 'capacity', key: 'capacity', title: '容量', type: 'number', active: true },
			{ id: 'remote', key: 'remote', title: '远程', type: 'boolean', active: true },
			{ id: 'skills', key: 'skills', title: '技能', type: 'multi-select', active: true, options: [{ id: 'ts', name: 'TypeScript' }, { id: 'ux', name: 'UX' }] },
		]);
		const people = collectPeopleFromMetadata([
			{ path: 'People/Alice.md', basename: 'Alice', frontmatter: { name: 'Alice Chen', role: '设计师', capacity: '80', remote: true, skills: ['ts', 'ux'] } },
			{ path: 'Archive/Bob.md', basename: 'Bob', frontmatter: { name: 'Bob' } },
		], normalizePeopleSourceSettings({ enabled: true, folder: 'People' }), fields);
		expect(people).toHaveLength(1);
		expect(people[0]).toMatchObject({
			name: 'Alice Chen', active: true, sourcePath: 'People/Alice.md',
			metadata: { role: '设计师', capacity: 80, remote: true, skills: ['ts', 'ux'] },
		});
		expect(people[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
	});

	it('uses the persisted person id when a person Markdown file provides one', () => {
		const people = collectPeopleFromMetadata([
			{ path: 'People/Alice.md', basename: 'Alice', frontmatter: { 'person-id': '11111111-1111-4111-8111-111111111111', name: 'Alice' } },
		], normalizePeopleSourceSettings({ enabled: true, folder: 'People' }));
		expect(people[0]).toMatchObject({
			id: '11111111-1111-4111-8111-111111111111', sourcePath: 'People/Alice.md', name: 'Alice',
		});
	});

	it('normalizes supported person metadata field types and presentation', () => {
		const fields = normalizePersonMetadataFields([
			{ id: 'a', key: ' role ', title: ' 岗位 ', type: 'text', active: true, icon: 'badge', color: '#AABBCC' },
			...['multiline-text', 'number', 'boolean', 'date', 'datetime', 'single-select', 'multi-select'].map((type, index) => ({
				id: `field-${index}`, key: `field_${index}`, title: `字段 ${index}`, type, active: true,
			})),
		]);
		expect(fields.map((field) => field.type)).toEqual(['text', 'multiline-text', 'number', 'boolean', 'date', 'datetime', 'single-select', 'multi-select']);
		expect(fields[0]).toMatchObject({ key: 'role', title: '岗位', icon: 'badge', color: '#aabbcc' });
	});

	it('replaces sourced people while preserving manual people and a missing current user', () => {
		const people = reconcileSourcedPeople([
			{ id: 'manual', name: 'Manual', active: true },
			{ id: 'current', name: 'Current', active: true, sourcePath: 'People/Current.md' },
			{ id: 'stale', name: 'Stale', active: true, sourcePath: 'People/Stale.md' },
		], [
			{ id: 'fresh', name: 'Fresh', active: true, sourcePath: 'People/Fresh.md' },
		], 'current');

		expect(people.map((person) => person.id)).toEqual(['manual', 'current', 'fresh']);
	});
});
