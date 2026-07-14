import { describe, expect, it } from 'vitest';
import type { ConfigurationSnapshot, ConfigurationStore } from '../../src/settings/configuration-store';
import { loadOrMigrateConfiguration, normalizeConfigurationSnapshot } from '../../src/settings/configuration-store';

const snapshot: ConfigurationSnapshot = {
	globalConfig: {
		kind: 'global-config', schema: 1, projectConfigDirectory: 'legacy/projects',
		defaultTaskDirectory: 'tasks', currentUserId: '8a67a66f-0109-47b3-9463-5d05b4295949',
		people: [{ id: '8a67a66f-0109-47b3-9463-5d05b4295949', name: '用户', active: true }],
	},
	projects: [],
	tagOrder: [],
};

class MemoryStore implements ConfigurationStore {
	value: ConfigurationSnapshot | null = null;
	async load() { return this.value ? structuredClone(this.value) : null; }
	async save(value: ConfigurationSnapshot) { this.value = structuredClone(value); }
}

describe('configuration store migration', () => {
	it('adds empty template and saved-filter catalogs to legacy snapshots', () => {
		const normalized = normalizeConfigurationSnapshot(snapshot);
		expect(normalized.taskTemplates).toEqual([]);
		expect(normalized.savedProjectFilters).toEqual([]);
		expect(normalized.tagStyles).toEqual({});
		expect(normalized.tagGroups).toEqual([]);
		expect(normalized.tagGroupAssignments).toEqual({});
		expect(normalized.projectViewDisplay.list).toContain('key');
		expect(normalized.projectViewDisplay.list).toContain('title');
		expect(normalized.projectViewDisplay.board).toContain('status');
		expect(normalized.projectViewDisplay.calendar).toContain('title');
		expect(normalized.projectViewDisplay.quadrants).toContain('priority');
	});

	it('persists and verifies legacy configuration before deleting Markdown files', async () => {
		const store = new MemoryStore();
		const events: string[] = [];
		const loaded = await loadOrMigrateConfiguration(store, async () => ({
			snapshot,
			cleanup: async () => { events.push('cleanup'); },
		}));
		expect(loaded).toEqual(normalizeConfigurationSnapshot(snapshot));
		expect(await store.load()).toEqual(normalizeConfigurationSnapshot(snapshot));
		expect(events).toEqual(['cleanup']);
	});

	it('uses plugin data directly without reading or deleting legacy files', async () => {
		const store = new MemoryStore();
		await store.save(snapshot);
		let legacyCalled = false;
		await loadOrMigrateConfiguration(store, async () => {
			legacyCalled = true;
			return null;
		});
		expect(legacyCalled).toBe(false);
	});

	it('persists normalized catalogs and dashboard layout for an existing snapshot', async () => {
		const store = new MemoryStore();
		await store.save(snapshot);
		await loadOrMigrateConfiguration(store, async () => null);
		expect(await store.load()).toEqual(normalizeConfigurationSnapshot(snapshot));
	});
});
