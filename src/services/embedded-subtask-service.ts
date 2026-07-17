import type { EmbeddedSubtask, TaskPriority } from '../domain/types';
import { localDateTime } from '../utils/dates';
import { createUuid } from '../utils/ids';

export interface EmbeddedSubtaskInput {
	title: string;
	priority: TaskPriority;
	scheduledDate: string | null;
	startDate: string | null;
	dueDate: string | null;
	tags: string[];
	custom?: Record<string, unknown>;
}

function normalizedTitle(value: string): string {
	const title = value.trim().replace(/[\r\n]+/gu, ' ');
	if (!title) throw new Error('子任务标题不能为空。');
	return title;
}

function normalizedTags(tags: readonly string[]): string[] {
	return [...new Set(tags.map((tag) => tag.trim().replace(/^#+/u, '')).filter(Boolean))];
}

export function createEmbeddedSubtask(
	input: EmbeddedSubtaskInput,
	now = new Date(),
	uuidFactory = createUuid,
): EmbeddedSubtask {
	const timestamp = localDateTime(now);
	return {
		id: uuidFactory().replace(/-/gu, '').slice(0, 8),
		title: normalizedTitle(input.title),
		completed: false,
		priority: input.priority,
		scheduledDate: input.scheduledDate,
		startDate: input.startDate,
		dueDate: input.dueDate,
		tags: normalizedTags(input.tags),
		custom: structuredClone(input.custom ?? {}),
		createdDate: timestamp.slice(0, 10), doneDate: null, cancelledDate: null,
	};
}

export function updateEmbeddedSubtask(
	current: EmbeddedSubtask,
	patch: Partial<Omit<EmbeddedSubtask, 'id' | 'createdAt' | 'updatedAt'>>,
	now = new Date(),
): EmbeddedSubtask {
	return {
		...current,
		...patch,
		title: normalizedTitle(patch.title ?? current.title),
		tags: normalizedTags(patch.tags ?? current.tags),
		id: current.id,
		createdDate: current.createdDate,
		doneDate: (patch.completed ?? current.completed) ? localDateTime(now).slice(0, 10) : null,
	};
}
