import type {
	TaskMetadata,
	WorkflowDefinition,
	WorkflowStatus,
} from './types';
import { localDateTime } from '../utils/dates';

function findStatus(
	workflow: WorkflowDefinition,
	statusId: string,
): WorkflowStatus {
	const status = workflow.statuses.find((item) => item.id === statusId);
	if (!status) throw new Error(`工作流状态不存在：${statusId}`);
	return status;
}

export function transitionTask(
	task: TaskMetadata,
	workflow: WorkflowDefinition,
	targetStatusId: string,
	now = new Date(),
): TaskMetadata {
	const transition = workflow.transitions.find(
		(item) => item.from === task.statusId && item.to === targetStatusId,
	);
	if (!transition) {
		throw new Error(`不允许从 ${task.statusId} 转换到 ${targetStatusId}。`);
	}
	const target = findStatus(workflow, targetStatusId);
	const next = { ...task, statusId: targetStatusId };
	if (target.category === 'in_progress' && next.startDate === null) {
		next.startDate = localDateTime(now);
	}
	if (target.category !== 'done') {
		next.completedAt = null;
		next.terminatedAt = null;
	} else if (target.result === 'completed') {
		next.completedAt = localDateTime(now);
		next.terminatedAt = null;
	} else {
		next.terminatedAt = localDateTime(now);
		next.completedAt = null;
	}
	return next;
}

export function availableTransitions(
	statusId: string,
	workflow: WorkflowDefinition,
) {
	return workflow.transitions.filter((transition) => transition.from === statusId);
}
