import { expect, it } from 'vitest';
import { COMMAND_IDS } from '../../src/commands/command-ids';
import { readFileSync } from 'node:fs';

it('keeps the three public task and view command ids stable', () => {
	expect(COMMAND_IDS).toEqual([
		'open-personal-view',
		'open-project-view',
		'create-task',
	]);
});

it('uses the personal dashboard name while retaining stable ids', () => {
	const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
	const commands = readFileSync(new URL('../../src/commands/register-commands.ts', import.meta.url), 'utf8');
	const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
	expect(personal).toContain("getDisplayText(): string { return '个人仪表盘'; }");
	expect(commands).toContain("name: '打开个人仪表盘'");
	expect(main).toContain("'打开个人仪表盘'");
});
