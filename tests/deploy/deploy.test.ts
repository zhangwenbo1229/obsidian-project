import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const deployScript = resolve('scripts/deploy.mjs');
const temporaryDirectories: string[] = [];

function makeDirectory(prefix: string): string {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	temporaryDirectories.push(directory);
	return directory;
}

function createProject(styles = true): string {
	const project = makeDirectory('obsidian-project-source-');
	writeFileSync(
		join(project, 'manifest.json'),
		JSON.stringify({ id: 'obsidian-project' }),
	);
	writeFileSync(join(project, 'main.js'), 'compiled plugin');
	if (styles) writeFileSync(join(project, 'styles.css'), 'plugin styles');
	return project;
}

function createVault(): string {
	const vault = makeDirectory('obsidian-project-vault-');
	mkdirSync(join(vault, '.obsidian'));
	return vault;
}

function runDeploy(project: string, vault?: string) {
	const environment = { ...process.env };
	if (vault) environment.OBSIDIAN_VAULT_PATH = vault;
	else delete environment.OBSIDIAN_VAULT_PATH;

	return spawnSync(process.execPath, [deployScript], {
		cwd: project,
		env: environment,
		encoding: 'utf8',
	});
}

afterEach(() => {
	for (const directory of temporaryDirectories) {
		rmSync(directory, { recursive: true, force: true });
	}
	temporaryDirectories.length = 0;
});

describe('deploy script', () => {
	it('requires OBSIDIAN_VAULT_PATH', () => {
		const result = runDeploy(createProject());

		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('OBSIDIAN_VAULT_PATH');
	});

	it('rejects a directory that is not an Obsidian vault', () => {
		const result = runDeploy(createProject(), makeDirectory('not-a-vault-'));

		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('.obsidian');
	});

	it('copies required release artifacts into the manifest plugin directory', () => {
		const project = createProject();
		const vault = createVault();

		const result = runDeploy(project, vault);

		expect(result.status).toBe(0);
		const target = join(
			vault,
			'.obsidian',
			'plugins',
			'obsidian-project',
		);
		expect(readFileSync(join(target, 'main.js'), 'utf8')).toBe(
			'compiled plugin',
		);
		expect(readFileSync(join(target, 'manifest.json'), 'utf8')).toContain(
			'obsidian-project',
		);
		expect(readFileSync(join(target, 'styles.css'), 'utf8')).toBe(
			'plugin styles',
		);
	});

	it('allows styles.css to be absent', () => {
		const project = createProject(false);
		const vault = createVault();

		const result = runDeploy(project, vault);

		expect(result.status).toBe(0);
		expect(
			existsSync(
				join(
					vault,
					'.obsidian',
					'plugins',
					'obsidian-project',
					'styles.css',
				),
			),
		).toBe(false);
	});

	it('rejects a manifest id that could escape the plugins directory', () => {
		const project = createProject();
		writeFileSync(
			join(project, 'manifest.json'),
			JSON.stringify({ id: '../outside' }),
		);

		const result = runDeploy(project, createVault());

		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('plugin id');
	});
});
