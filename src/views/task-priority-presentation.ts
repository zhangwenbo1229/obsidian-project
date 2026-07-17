import type { CustomFieldOption, ProjectPriority } from '../domain/types';

const PRIORITY_LABELS: Record<string, string> = {
	high: '高',
	medium: '中',
	low: '低',
};

export function renderTaskPriority(
	parent: HTMLElement,
	priority: ProjectPriority | undefined,
	options: readonly CustomFieldOption[] = [],
): HTMLElement {
	const value = priority ?? 'medium';
	const label = options.find((option) => option.id === value)?.name ?? PRIORITY_LABELS[value] ?? value;
	const classSuffix = value.replace(/[^a-z0-9_-]+/giu, '-');
	return parent.createSpan({
		cls: `op-priority is-${classSuffix}`,
		text: label,
		attr: { title: `优先级：${label}` },
	});
}
