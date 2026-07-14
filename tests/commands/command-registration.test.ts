import { expect, it } from 'vitest';
import { COMMAND_IDS } from '../../src/commands/command-ids';

it('keeps the three public task and view command ids stable', () => {
	expect(COMMAND_IDS).toEqual([
		'open-personal-view',
		'open-project-view',
		'create-task',
	]);
});
