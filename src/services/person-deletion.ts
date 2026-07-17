interface PersonReferenceDocument {
	metadata: {
		reporterId?: string;
		assigneeId?: string | null;
		custom?: Record<string, unknown>;
	};
	notes?: Array<{ authorId?: string }>;
}

function containsPersonId(value: unknown, personId: string): boolean {
	if (value === personId) return true;
	if (Array.isArray(value)) return value.some((item) => containsPersonId(item, personId));
	if (!value || typeof value !== 'object') return false;
	return Object.values(value as Record<string, unknown>).some((item) => containsPersonId(item, personId));
}

export function personDeletionBlockReason(
	personId: string,
	currentUserId: string,
	documents: readonly PersonReferenceDocument[],
): string | null {
	if (personId === currentUserId) return '不能删除当前用户，请先切换当前用户。';
	const referenceCount = documents.filter((document) =>
		document.metadata.reporterId === personId
		|| document.metadata.assigneeId === personId
		|| containsPersonId(document.metadata.custom, personId)
		|| document.notes?.some((note) => note.authorId === personId),
	).length;
	return referenceCount > 0 ? `该人员仍被 ${referenceCount} 个项目引用，请先移除相关人员字段。` : null;
}
