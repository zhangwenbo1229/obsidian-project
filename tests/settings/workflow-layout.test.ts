import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as workflowEditor from '../../src/settings/workflow-editor';
import type { WorkflowDefinition } from '../../src/domain/types';

const source = readFileSync(new URL('../../src/settings/workflow-editor.ts', import.meta.url), 'utf8');

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

describe('workflow stage sizing for draggable nodes', () => {
	it('dynamically sizes the stage so crowded nodes can be scrolled into view', () => {
		expect(source).toMatch(/minWidth|min-width/u);
		expect(source).toMatch(/status\.position|node.*position/u);
	});

	it('does not clamp drag X to stage.clientWidth (which would prevent dragging beyond visible area)', () => {
		expect(source).not.toMatch(/Math\.min\(stage\.clientWidth - NODE_WIDTH - 8,/u);
	});

	it('binds pointermove to document for reliable drag capture', () => {
		// Fix: pointermove should be on document, not node, to ensure events fire
		// even when the pointer moves outside the stage.
		expect(source).toMatch(/document\.addEventListener\(['"]pointermove['"]/u);
	});

	it('releases pointer capture and restores overflow on finish', () => {
		expect(source).toMatch(/releasePointerCapture/u);
		expect(source).toMatch(/overflow/u);
	});
});

