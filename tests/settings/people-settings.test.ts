import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('people settings actions', () => {
	it('routes person deletion through the manager and protects the current user in the UI', () => {
		const settings = readFileSync(new URL('../../src/settings/settings-tab.ts', import.meta.url), 'utf8');
		const manager = readFileSync(new URL('../../src/services/personnel-service.ts', import.meta.url), 'utf8');
		expect(settings).toContain("setButtonText('删除')");
		expect(settings).toContain('deletePerson(person.id)');
		expect(settings).toContain('person.id === this.plugin.manager.globalConfig.currentUserId');
		expect(manager).toContain('async deletePerson(');
		expect(manager).toContain('personDeletionBlockReason');
	});
});
