import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['scripts/**/*.mjs', 'tests/**/*.ts', 'vitest.config.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'obsidianmd/hardcoded-config-path': 'off',
			'obsidianmd/no-nodejs-modules': 'off',
			'obsidianmd/rule-custom-message': 'off',
		},
	},
	{
		files: ['scripts/seed-demo.mjs'],
		languageOptions: {
			globals: {
				app: 'readonly',
			},
		},
		rules: {
			'no-restricted-globals': 'off',
			'obsidianmd/prefer-window-timers': 'off',
		},
	},
	{
		rules: {
			// Declarative settings require Obsidian 1.13; the plugin supports 1.7.2.
			'obsidianmd/settings-tab/prefer-setting-definitions': 'off',
		},
	},
);
