import { describe, expect, it } from 'vitest';
import { renderTaskPriority } from '../../src/views/task-priority-presentation';

describe('custom project priority label', () => {
	it('renders the configured label for a custom project priority', () => {
		const parent = {
			createSpan(options: { text: string; attr: { title: string } }) {
				return { textContent: options.text, title: options.attr.title } as HTMLElement;
			},
		};
		const priority = renderTaskPriority(parent as unknown as HTMLElement, 'critical', [{ id: 'critical', name: '紧急' }]);
		expect(priority.textContent).toBe('紧急');
		expect(priority.title).toBe('优先级：紧急');
	});
});
