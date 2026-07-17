import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const helperUrl = new URL('../../src/views/task-type-presentation.ts', import.meta.url);
const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
const project = readFileSync(new URL('../../src/views/project-view.ts', import.meta.url), 'utf8');
const projectList = readFileSync(new URL('../../src/views/project-list-renderer.ts', import.meta.url), 'utf8');
const cardFields = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('task type presentation', () => {
	it('centralizes marker and title color rendering', () => {
		expect(existsSync(helperUrl)).toBe(true);
		if (existsSync(helperUrl)) {
			const source = readFileSync(helperUrl, 'utf8');
			expect(source).toContain('marker ?? taskType.icon');
			expect(source).toContain('titleColor');
			expect(source).toContain('setIcon');
		}
	});

	it('uses the shared renderer in personal and every project task mode', () => {
		expect(cardFields).toContain('renderTaskTitle');
		expect(personal).toContain('renderTaskCardFields');
		expect(personal).toMatch(/renderTaskCardFields\([^;]+markerBeforeKey:\s*true/u);
		expect(project.match(/renderTaskCardFields/g)?.length).toBeGreaterThanOrEqual(3);
	});

	it('renders the task marker in the list key cell and enforces configured title color', () => {
		const cardFields = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');
		expect(project).toContain('renderProjectList');
		expect(projectList).toContain('renderTaskListField');
		expect(cardFields).toMatch(/field === 'key'[\s\S]{0,320}renderTaskMarker/u);
		expect(cardFields).toMatch(/field === 'title'[\s\S]{0,320}renderTaskTitle/u);
		expect(helperUrl && readFileSync(helperUrl, 'utf8')).toContain('--op-task-title-color');
		expect(css).toMatch(/\.op-task-title-text\s*\{[^}]*color:\s*var\(--op-task-title-color[^}]*!important/u);
	});
});
