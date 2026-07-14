import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rendererUrl = new URL('../../src/views/task-priority-presentation.ts', import.meta.url);
const fieldsUrl = new URL('../../src/views/task-card-fields.ts', import.meta.url);
const projectSource = readFileSync(new URL('../../src/views/project-view.ts', import.meta.url), 'utf8');

describe('task priority presentation', () => {
	it('uses one special priority renderer in every project card mode', () => {
		expect(existsSync(rendererUrl)).toBe(true);
		expect(existsSync(fieldsUrl)).toBe(true);
		if (existsSync(fieldsUrl)) expect(readFileSync(fieldsUrl, 'utf8')).toContain('renderTaskPriority');
		expect(projectSource.match(/renderTaskCardFields/gmu)?.length ?? 0).toBeGreaterThanOrEqual(3);
		expect(projectSource).toContain("displayFields('board')");
		expect(projectSource).toContain("displayFields('calendar')");
		expect(projectSource).toContain("displayFields('quadrants')");
	});
});
