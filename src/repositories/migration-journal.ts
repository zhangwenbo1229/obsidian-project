import type { VaultAdapter } from './vault-adapter';
import type { ProjectConfig, TaskDocument } from '../domain/types';

const MIGRATION_DIRECTORY = '项目管理/.迁移';

export interface MigrationJournalItem {
	uid: string;
	oldPath: string;
	newPath: string;
	oldKey?: string;
	newKey?: string;
	projectUid?: string;
	document?: TaskDocument;
	baseline?: TaskDocument;
	removedCustomKeys?: string[];
	completed: boolean;
	details?: unknown;
}

export type MigrationFinalization =
	| {
		type: 'project-code';
		projectUid: string;
		oldPath: string;
		newPath: string;
		project: ProjectConfig;
	}
	| {
		type: 'custom-field-key';
		projectUid: string;
		fieldId: string;
		newKey: string;
	};

export interface MigrationJournalState {
	id: string;
	type: string;
	createdAt: string;
	items: MigrationJournalItem[];
	finalization?: MigrationFinalization | null;
	finalized?: boolean;
}

export class MigrationJournal {
	private readonly path: string;

	constructor(
		private readonly vault: VaultAdapter,
		private readonly id: string,
	) {
		this.path = `${MIGRATION_DIRECTORY}/${id}.json`;
	}

	async create(
		type: string,
		items: Array<Omit<MigrationJournalItem, 'completed'>>,
		finalization: MigrationFinalization | null = null,
	): Promise<void> {
		await this.vault.ensureFolder(MIGRATION_DIRECTORY);
		const state: MigrationJournalState = {
			id: this.id,
			type,
			createdAt: new Date().toISOString(),
			items: items.map((item) => ({ ...item, completed: false })),
			finalization,
			finalized: finalization === null,
		};
		await this.vault.create(this.path, JSON.stringify(state, null, 2));
	}

	async read(): Promise<MigrationJournalState> {
		return JSON.parse(await this.vault.read(this.path)) as MigrationJournalState;
	}

	async complete(uid: string): Promise<void> {
		await this.vault.process(this.path, (source) => {
			const state = JSON.parse(source) as MigrationJournalState;
			const item = state.items.find((candidate) => candidate.uid === uid);
			if (item) item.completed = true;
			return JSON.stringify(state, null, 2);
		});
	}

	async completeFinalization(): Promise<void> {
		await this.vault.process(this.path, (source) => {
			const state = JSON.parse(source) as MigrationJournalState;
			state.finalized = true;
			return JSON.stringify(state, null, 2);
		});
	}

	static async listIncomplete(vault: VaultAdapter): Promise<MigrationJournalState[]> {
		const states: MigrationJournalState[] = [];
		for (const path of await vault.listFiles(MIGRATION_DIRECTORY)) {
			if (!path.endsWith('.json')) continue;
			try {
				const state = JSON.parse(await vault.read(path)) as MigrationJournalState;
				const finalizationPending = state.finalization != null && state.finalized !== true;
				if (state.items.some((item) => !item.completed) || finalizationPending) states.push(state);
			} catch {
				// Invalid journals remain available for manual inspection without blocking the plugin.
			}
		}
		return states.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
	}
}
