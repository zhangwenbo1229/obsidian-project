import type { EmbeddedSubtask } from '../domain/types';
import { removeEmbeddedSubtask, upsertEmbeddedSubtask } from '../markdown/embedded-subtask-parser';

export function addDraftSubtask(markdown: string, subtask: EmbeddedSubtask): string {
	return upsertEmbeddedSubtask(markdown, subtask);
}

export function updateDraftSubtask(markdown: string, subtask: EmbeddedSubtask): string {
	return upsertEmbeddedSubtask(markdown, subtask);
}

export function deleteDraftSubtask(markdown: string, id: string): string {
	return removeEmbeddedSubtask(markdown, id);
}
