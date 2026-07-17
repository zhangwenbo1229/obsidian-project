import { describe, expect, it } from 'vitest';
import type { ConfigurationSnapshot } from '../../src/settings/configuration-store';

describe('project manager configuration snapshots', () => {
	it('always emits the current schema after normal saves', async () => {
		const { createProjectManagerConfigurationSnapshot } = await import('../../src/services/project-manager-configuration');
		const snapshot = createProjectManagerConfigurationSnapshot({
			globalConfig: {
				kind: 'global-config', schema: 1, projectConfigDirectory: 'Projects', defaultTaskDirectory: 'Tasks',
				currentUserId: '11111111-1111-4111-8111-111111111111',
				people: [{ id: '11111111-1111-4111-8111-111111111111', name: 'User', active: true }],
				personMetadataFields: [],
			},
			projects: [],
			tagOrder: [],
		} satisfies ConfigurationSnapshot);
		expect(snapshot.configurationSchema).toBe(2);
	});
});
