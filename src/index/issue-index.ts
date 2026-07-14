import type { ValidationIssue } from '../domain/types';
import type { IndexIssue } from './task-index';

export class IssueIndex {
	private issuesByPath = new Map<string, ValidationIssue[]>();

	replace(path: string, issues: ValidationIssue[]): void {
		if (issues.length === 0) this.issuesByPath.delete(path);
		else this.issuesByPath.set(path, [...issues]);
	}

	remove(path: string): void {
		this.issuesByPath.delete(path);
	}

	all(indexIssues: readonly IndexIssue[] = []): Array<{
		path: string;
		issue: ValidationIssue;
	}> {
		const output: Array<{ path: string; issue: ValidationIssue }> = [];
		for (const [path, issues] of this.issuesByPath) {
			for (const issue of issues) output.push({ path, issue });
		}
		for (const issue of indexIssues) {
			for (const path of issue.paths) output.push({ path, issue });
		}
		return output;
	}
}
