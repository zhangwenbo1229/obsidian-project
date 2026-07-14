import type { GlobalConfig } from '../domain/types';
import {
	parseGlobalConfigMarkdown,
	serializeGlobalConfigMarkdown,
} from '../markdown/config-parser';
import type { VaultAdapter } from './vault-adapter';

export class GlobalConfigRepository {
	constructor(
		private readonly vault: VaultAdapter,
		private readonly path: string,
	) {}

	async create(config: GlobalConfig): Promise<void> {
		const parent = this.path.split('/').slice(0, -1).join('/');
		if (parent) await this.vault.ensureFolder(parent);
		await this.vault.create(this.path, serializeGlobalConfigMarkdown(config));
	}

	async read(): Promise<GlobalConfig> {
		const parsed = parseGlobalConfigMarkdown(await this.vault.read(this.path));
		if (!parsed.config || parsed.issues.length > 0) {
			throw new Error(parsed.issues.map((item) => item.message).join('\n'));
		}
		return parsed.config;
	}

	async save(config: GlobalConfig): Promise<void> {
		await this.vault.process(this.path, () => serializeGlobalConfigMarkdown(config));
	}
}
