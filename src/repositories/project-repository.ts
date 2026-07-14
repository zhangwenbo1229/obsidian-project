import type { ProjectConfig, ValidationIssue } from '../domain/types';
import {
	parseProjectConfigMarkdown,
	serializeProjectConfigMarkdown,
} from '../markdown/config-parser';
import type { VaultAdapter } from './vault-adapter';

export interface ProjectFile {
	path: string;
	config: ProjectConfig | null;
	issues: ValidationIssue[];
}

export class ProjectRepository {
	constructor(
		private readonly vault: VaultAdapter,
		private readonly directory: string,
	) {}

	async create(project: ProjectConfig): Promise<string> {
		await this.vault.ensureFolder(this.directory);
		const path = `${this.directory}/${project.code}.md`;
		await this.vault.create(path, serializeProjectConfigMarkdown(project));
		return path;
	}

	async list(): Promise<ProjectFile[]> {
		const prefix = `${this.directory}/`;
		const paths = (await this.vault.listMarkdownFiles()).filter(
			(path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'),
		);
		return Promise.all(
			paths.map(async (path) => {
				const parsed = parseProjectConfigMarkdown(await this.vault.read(path));
				return { path, config: parsed.config, issues: parsed.issues };
			}),
		);
	}

	async save(path: string, project: ProjectConfig): Promise<void> {
		await this.vault.process(path, () => serializeProjectConfigMarkdown(project));
	}

	rename(path: string, nextPath: string): Promise<void> {
		return this.vault.rename(path, nextPath);
	}

	trash(path: string): Promise<void> {
		return this.vault.trash(path);
	}
}
