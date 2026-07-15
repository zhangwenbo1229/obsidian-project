import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const directories: string[] = [];
afterEach(() => { for (const directory of directories) rmSync(directory, { recursive: true, force: true }); directories.length = 0; });

it('rejects a release tag that differs from package and manifest versions', () => {
	const directory = mkdtempSync(join(tmpdir(), 'obsidian-project-release-')); directories.push(directory);
	writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '1.0.0' }));
	writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ version: '1.0.0' }));
	const result = spawnSync(process.execPath, [resolve('scripts/check-release.mjs'), '1.0.1'], { cwd: directory, encoding: 'utf8' });
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('1.0.1');
});

it('publishes validated tag builds as a non-draft GitHub release', () => {
	const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
	expect(workflow).toContain('npm test');
	expect(workflow).toContain('npm run lint');
	expect(workflow).toContain('gh release create');
	expect(workflow).not.toContain('--draft');
	expect(workflow).toContain('--verify-tag');
});
