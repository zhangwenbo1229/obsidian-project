import {
	copyFile,
	mkdir,
	readFile,
	rm,
	stat,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

async function isDirectory(path) {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}

async function isFile(path) {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

function validatePluginId(pluginId) {
	if (
		typeof pluginId !== 'string' ||
		!/^[a-z0-9][a-z0-9-]*$/.test(pluginId)
	) {
		throw new Error('Invalid plugin id in manifest.json.');
	}
}

function assertPathInside(parent, child) {
	const pathFromParent = relative(parent, child);
	if (
		pathFromParent === '' ||
		pathFromParent === '..' ||
		pathFromParent.startsWith(`..${sep}`) ||
		resolve(child) !== child
	) {
		throw new Error('Plugin target must stay inside the Vault plugins directory.');
	}
}

export async function deployArtifacts(
	projectDirectory = process.cwd(),
	environment = process.env,
) {
	const configuredVault = environment.OBSIDIAN_VAULT_PATH;
	if (!configuredVault) {
		throw new Error('OBSIDIAN_VAULT_PATH is required for deployment.');
	}

	const sourceRoot = resolve(projectDirectory);
	const vaultRoot = resolve(configuredVault);
	const obsidianDirectory = join(vaultRoot, '.obsidian');
	if (!(await isDirectory(vaultRoot)) || !(await isDirectory(obsidianDirectory))) {
		throw new Error(
			`OBSIDIAN_VAULT_PATH must contain an .obsidian directory: ${vaultRoot}`,
		);
	}

	const manifestPath = join(sourceRoot, 'manifest.json');
	const mainPath = join(sourceRoot, 'main.js');
	if (!(await isFile(manifestPath)) || !(await isFile(mainPath))) {
		throw new Error('Deployment requires manifest.json and main.js.');
	}

	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	validatePluginId(manifest.id);

	const pluginsDirectory = resolve(obsidianDirectory, 'plugins');
	const targetDirectory = resolve(pluginsDirectory, manifest.id);
	assertPathInside(pluginsDirectory, targetDirectory);
	await mkdir(targetDirectory, { recursive: true });

	await Promise.all([
		copyFile(mainPath, join(targetDirectory, 'main.js')),
		copyFile(manifestPath, join(targetDirectory, 'manifest.json')),
	]);

	const sourceStyles = join(sourceRoot, 'styles.css');
	const targetStyles = join(targetDirectory, 'styles.css');
	if (await isFile(sourceStyles)) {
		await copyFile(sourceStyles, targetStyles);
	} else {
		await rm(targetStyles, { force: true });
	}

	return targetDirectory;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
	try {
		const target = await deployArtifacts(dirname(join(process.cwd(), 'package.json')));
		process.stdout.write(`Deployed plugin to ${target}\n`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
