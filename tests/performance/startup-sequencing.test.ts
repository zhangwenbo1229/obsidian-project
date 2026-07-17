import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('registers plugin surfaces before starting the asynchronous task index', () => {
	const source = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
	const configure = source.indexOf('await this.manager.initializeConfiguration()');
	const registerView = source.indexOf('this.registerView');
	const registerCommands = source.indexOf('registerCommands(this)');
	const buildIndex = source.indexOf('this.manager.initializeTaskIndex()');
	expect(configure).toBeGreaterThan(-1);
	expect(registerView).toBeGreaterThan(configure);
	expect(registerCommands).toBeGreaterThan(registerView);
	expect(buildIndex).toBeGreaterThan(registerCommands);
	expect(source.slice(buildIndex - 20, buildIndex)).not.toContain('await');
});
