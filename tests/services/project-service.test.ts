import { expect, it } from 'vitest';
import { validateProjectDeletion } from '../../src/services/project-service';

it('blocks project deletion while any task still belongs to it', () => {
	const issues = validateProjectDeletion('project-1', [{ metadata: { projectUid: 'project-1' } }]);
	expect(issues[0]?.code).toBe('project-has-tasks');
	expect(validateProjectDeletion('project-1', [])).toEqual([]);
});
