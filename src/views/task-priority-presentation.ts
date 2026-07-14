import type { TaskPriority } from '../domain/types';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
	high: '高',
	medium: '中',
	low: '低',
};

export function renderTaskPriority(parent: HTMLElement, priority: TaskPriority | undefined): HTMLElement {
	const value = priority ?? 'medium';
	return parent.createSpan({
		cls: `op-priority is-${value}`,
		text: PRIORITY_LABELS[value],
		attr: { title: `优先级：${PRIORITY_LABELS[value]}` },
	});
}
