import type { ValidationIssue } from '../domain/types';

export function validateProjectDeletion(
	projectUid: string,
	tasks: ReadonlyArray<{ metadata: { projectUid: string } }>,
): ValidationIssue[] {
	const count = tasks.filter((task) => task.metadata.projectUid === projectUid).length;
	return count > 0
		? [{ code: 'project-has-tasks', path: projectUid, message: `项目仍包含 ${count} 个任务，请先迁移或删除。` }]
		: [];
}
