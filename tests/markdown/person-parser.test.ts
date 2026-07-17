import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../../src/markdown/frontmatter';
import { personMarkdownPath, serializePersonMarkdown } from '../../src/markdown/person-parser';

describe('person Markdown files', () => {
	it('serializes stable identity, configured metadata properties and a readable body', () => {
		const source = serializePersonMarkdown(
			{ id: '11111111-1111-4111-8111-111111111111', name: 'Alice', active: true, metadata: { role: 'Designer', remote: true } },
			{ enabled: true, folder: 'People', nameProperty: 'display-name' },
			[
				{ id: 'role', key: 'role', title: 'Role', type: 'text', active: true, sourceProperty: 'job-title' },
				{ id: 'remote', key: 'remote', title: 'Remote', type: 'boolean', active: true },
			],
		);
		const parsed = parseFrontmatter(source);
		expect(parsed.frontmatter).toMatchObject({
			'pm-kind': 'person', 'pm-schema': 1, 'person-id': '11111111-1111-4111-8111-111111111111',
			'display-name': 'Alice', active: true, 'job-title': 'Designer', remote: true,
		});
		expect(parsed.body).toContain('# Alice');
	});

	it('builds a safe path in the configured folder', () => {
		expect(personMarkdownPath('People', 'Alice / Design')).toBe('People/Alice - Design.md');
		expect(personMarkdownPath('People', 'Alice-2026')).toBe('People/Alice-2026.md');
	});
});
