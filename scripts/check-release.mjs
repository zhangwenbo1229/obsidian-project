import { readFile } from 'node:fs/promises';

const tag = process.argv[2];
if (!tag) {
	process.stderr.write('Release tag is required.\n');
	process.exitCode = 1;
} else {
	const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
	const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
	if (tag !== packageJson.version || tag !== manifest.version) {
		process.stderr.write(
			`Release tag ${tag} must match package ${packageJson.version} and manifest ${manifest.version}.\n`,
		);
		process.exitCode = 1;
	}
}
