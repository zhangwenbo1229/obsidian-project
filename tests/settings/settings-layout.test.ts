import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

function ruleFor(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'u').exec(css)?.[1] ?? '';
}

describe('settings and sidebar surfaces', () => {
	it('uses an upper/lower settings layout instead of a left/right split', () => {
		expect(ruleFor('.op-settings-shell')).toMatch(/grid-template-columns:\s*1fr/u);
	});

	it('uses a pure white personal filter sidebar', () => {
		expect(ruleFor('.op-personal-sidebar')).toMatch(/background:\s*#fff(?:fff)?/u);
	});

	it('keeps quadrant tables within their desktop regions', () => {
		expect(ruleFor('.op-quadrant-table')).toMatch(/table-layout:\s*fixed/u);
		expect(ruleFor('.op-quadrant-table')).toMatch(/width:\s*100%/u);
		expect(ruleFor('.op-quadrant-table')).toMatch(/min-width:\s*0/u);
	});
});
