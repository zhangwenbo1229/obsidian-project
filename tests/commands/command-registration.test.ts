import { expect, it } from 'vitest';
import { COMMAND_IDS } from '../../src/commands/command-ids';
import { readFileSync } from 'node:fs';

it('keeps existing command ids stable and appends structured subtask creation', () => {
	expect(COMMAND_IDS).toEqual([
		'open-personal-view',
		'open-project-view',
		'create-task',
		'create-subtask',
		'open-task-view',
		'create-person',
	]);
});

it('registers a stable create-person command', () => {
	const commands = readFileSync(new URL('../../src/commands/register-commands.ts', import.meta.url), 'utf8');
	expect(commands).toContain("id: COMMAND_IDS[5]");
	expect(commands).toContain("name: '新增人员'");
	expect(commands).toContain('new PersonModal(plugin.manager).open()');
});

it('registers the dedicated task view without renaming existing command ids', () => {
	const commands = readFileSync(new URL('../../src/commands/register-commands.ts', import.meta.url), 'utf8');
	const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
	expect(commands).toContain("id: COMMAND_IDS[4]");
	expect(commands).toContain("name: '打开任务视图'");
	expect(commands).toContain('plugin.activateTaskView()');
	expect(main).toContain('TASK_VIEW_TYPE');
	expect(main).toContain("'打开任务视图'");
});

it('registers a metadata-aware embedded task command', () => {
	const commands = readFileSync(new URL('../../src/commands/register-commands.ts', import.meta.url), 'utf8');
	expect(commands).toContain("name: '新增任务'");
	expect(commands).toContain("name: '新增项目'");
	expect(commands).toContain('CreateSubtaskModal');
	expect(commands).toContain('getActiveFile');
	const registration = commands.slice(commands.indexOf("name: '新增任务'"));
	expect(registration).toContain('callback: async () =>');
	expect(registration).toContain('await plugin.manager.initializeTaskIndex()');
	expect(registration).not.toContain('checkCallback:');
});

it('uses the personal dashboard name while retaining stable ids', () => {
	const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
	const commands = readFileSync(new URL('../../src/commands/register-commands.ts', import.meta.url), 'utf8');
	const main = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
	expect(personal).toContain("getDisplayText(): string { return '个人仪表盘'; }");
	expect(commands).toContain("name: '打开个人仪表盘'");
	expect(main).toContain("'打开个人仪表盘'");
});
