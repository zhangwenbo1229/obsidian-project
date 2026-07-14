import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateConfiguredTaskFields } from '../../src/services/task-field-validation';

const moduleUrl = new URL('../../src/services/task-field-validation.ts', import.meta.url);

describe('configured task field validation', () => {
	it('reports enabled required fields and ignores hidden fields', () => {
		expect(existsSync(moduleUrl)).toBe(true);
		const type = {
			fieldConfig: {
				title: { enabled: true, required: true },
				links: { enabled: true, required: true },
				subtasks: { enabled: false, required: true },
			},
		};
		expect(validateConfiguredTaskFields(type as never, { title: '任务', links: '', subtasks: '' }))
			.toEqual(['链接为必填字段。']);
	});
});
