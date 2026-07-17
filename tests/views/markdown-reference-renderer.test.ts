// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { decorateMarkdownReferences } from '../../src/integrations/markdown-reference-renderer';
import * as referenceRenderer from '../../src/integrations/markdown-reference-renderer';
import { readFileSync } from 'node:fs';

describe('Markdown project and person references', () => {
	it('decorates resolved project wikilinks and person mentions while leaving unknown text intact', () => {
		const parsed = new DOMParser().parseFromString(
			'<div><p><a class="internal-link" data-href="PROJ-12">PROJ-12</a> 与 @Alice、@Unknown</p><code>@Alice</code></div>',
			'text/html',
		);
		const root = parsed.querySelector<HTMLElement>('div');
		if (!root) throw new Error('Reference fixture did not parse.');
		decorateMarkdownReferences(root, [{ key: 'PROJ-12', title: '发布计划', icon: 'rocket', color: '#ff3366' }], [{ name: 'Alice', title: '设计师', icon: 'palette', color: '#00aa55', sourcePath: 'People/Alice.md' }]);
		const project = root.querySelector<HTMLElement>('.op-project-reference');
		expect(project?.textContent).toContain('PROJ-12');
		expect(project?.textContent).toContain('发布计划');
		expect(project?.style.color).toBe('#ff3366');
		const person = root.querySelector<HTMLElement>('.op-person-reference');
		expect(person?.textContent).toBe('Alice');
		expect(person?.textContent).not.toContain('@');
		expect(person?.querySelector('.op-reference-icon')).not.toBeNull();
		expect(person?.title).toBe('设计师');
		expect(person?.tagName).toBe('A');
		expect(person?.getAttribute('data-href')).toBe('People/Alice.md');
		expect(root.textContent).toContain('@Unknown');
		expect(root.querySelector('code')?.textContent).toBe('@Alice');
	});

	it('removes native internal-link underlines from decorated references', () => {
		const css = readFileSync('styles.css', 'utf8');
		expect(css).toMatch(/\.op-project-reference,\s*\.op-person-reference\s*\{[^}]*text-decoration:\s*none\s*!important/u);
		expect(css).toMatch(/\.op-project-reference:hover,\s*\.op-person-reference:hover\s*\{[^}]*text-decoration:\s*none\s*!important/u);
	});

	it('matches project keys from path-qualified and URL-encoded Obsidian link targets', () => {
		const parsed = new DOMParser().parseFromString(
			'<div><a class="internal-link" data-href="项目/PROJ-12.md">路径链接</a><a class="internal-link" data-href="PROJ%2D13">编码链接</a></div>',
			'text/html',
		);
		const root = parsed.querySelector<HTMLElement>('div');
		if (!root) throw new Error('Reference fixture did not parse.');
		decorateMarkdownReferences(root, [
			{ key: 'PROJ-12', title: '发布计划' },
			{ key: 'PROJ-13', title: '编码计划' },
		], []);
		expect(root.querySelectorAll('.op-project-reference')).toHaveLength(2);
	});

	it('waits for the project index before decorating an already rendered note', async () => {
		const waitDecorator = (referenceRenderer as unknown as {
			decorateMarkdownReferencesWhenReady?: (
				root: HTMLElement,
				ready: Promise<void>,
				projects: () => Array<{ key: string; title: string }>,
				people: () => [],
			) => Promise<void>;
		}).decorateMarkdownReferencesWhenReady;
		expect(waitDecorator).toBeTypeOf('function');
		if (!waitDecorator) return;
		const parsed = new DOMParser().parseFromString('<div><a class="internal-link" data-href="PROJ-12">PROJ-12</a></div>', 'text/html');
		const root = parsed.querySelector<HTMLElement>('div');
		if (!root) throw new Error('Reference fixture did not parse.');
		let release = (): void => undefined;
		const ready = new Promise<void>((resolve) => { release = resolve; });
		const decorating = waitDecorator(root, ready, () => [{ key: 'PROJ-12', title: '发布计划' }], () => []);
		expect(root.querySelector('.op-project-reference')).toBeNull();
		release();
		await decorating;
		expect(root.querySelector('.op-project-reference')).not.toBeNull();
	});
});
