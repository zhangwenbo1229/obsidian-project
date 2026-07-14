import { describe, expect, it } from 'vitest';
import * as workflowEditor from '../../src/settings/workflow-editor';
import type { WorkflowDefinition } from '../../src/domain/types';

describe('workflow graph editing', () => {
	it('creates graph connections without self or duplicate transitions', () => {
		const connect = (workflowEditor as Record<string, unknown>).connectWorkflowStatuses as undefined | ((
			workflow: WorkflowDefinition,
			from: string,
			to: string,
			id: string,
		) => boolean);
		expect(typeof connect).toBe('function');
		if (!connect) return;
		const workflow: WorkflowDefinition = {
			initialStatusId: 'todo',
			statuses: [
				{ id: 'todo', name: '待办', category: 'todo', result: null, active: true },
				{ id: 'doing', name: '处理中', category: 'in_progress', result: null, active: true },
			],
			transitions: [],
		};
		expect(connect(workflow, 'todo', 'doing', 'transition-1')).toBe(true);
		expect(connect(workflow, 'todo', 'doing', 'transition-2')).toBe(false);
		expect(connect(workflow, 'todo', 'todo', 'transition-3')).toBe(false);
		expect(workflow.transitions).toEqual([{ id: 'transition-1', name: '待办 → 处理中', from: 'todo', to: 'doing' }]);
	});
});
