import type { App } from 'obsidian';
import type {
	GlobalConfig,
	ProjectConfig,
	SavedProjectFilter,
	TagGroup,
	TagStyle,
	TaskConfigurationTemplate,
	PersonalDashboardCardLayout,
	TaskDocument,
} from '../domain/types';
import { validateGlobalConfig, validateProjectConfig, validateTaskMetadata, validateTaskReferences } from '../domain/validation';
import { collectTaskTree } from '../domain/relations';
import { validateProjectDeletion } from './project-service';
import { reconcileProtectedIdentity, type ProtectedIdentity } from '../domain/protected-fields';
import { TaskIndex, type IndexedTask } from '../index/task-index';
import { collectTaskDataIssues, type PathIssue } from '../index/data-issues';
import { parseTaskMarkdown } from '../markdown/task-parser';
import {
	GlobalConfigRepository,
	ProjectRepository,
	TaskRepository,
} from '../repositories';
import { ObsidianVaultAdapter } from '../repositories/obsidian-vault-adapter';
import { MigrationJournal, type MigrationJournalState } from '../repositories/migration-journal';
import { createUuid } from '../utils/ids';
import { prepareNewTask, type NewTaskInput } from './task-service';
import { planTaskDeletion } from './deletion-service';
import {
	changeCustomFieldKey,
	planProjectCodeMigration,
	prepareProjectTransfer,
	refreshRelationKeys,
	resolveMigrationPath,
	type TransferMapping,
} from './migration-service';
import {
	loadOrMigrateConfiguration,
	type ConfigurationSnapshot,
	type ConfigurationStore,
} from '../settings/configuration-store';
import { moveTagStylePath, renameTagPath, renameTagStyles, repairMalformedTagStyles } from './tag-service';
import { applyConfigurationTemplate, applyConfigurationTemplates } from './template-service';
import { normalizeDashboardLayout } from '../views/dashboard-layout';
import { normalizeConfigurationSnapshot } from '../settings/configuration-store';
import { normalizeProjectViewDisplay, type ProjectViewDisplaySettings } from '../views/task-display-settings';
import { removeTagGroupAssignments, renameTagGroupAssignments, rootTagPath } from './tag-group-service';
import { normalizePersonalDashboardSettings, type PersonalDashboardSettings } from '../views/personal-dashboard-settings';

export const DEFAULT_GLOBAL_CONFIG_PATH = '项目管理/全局配置.md';

export class ProjectManager {
	readonly index = new TaskIndex();
	globalConfig!: GlobalConfig;
	projects: ProjectConfig[] = [];
	tagOrder: string[] = [];
	tagStyles: Record<string, TagStyle> = {};
	tagGroups: TagGroup[] = [];
	tagGroupAssignments: Record<string, string> = {};
	taskTemplates: TaskConfigurationTemplate[] = [];
	savedProjectFilters: SavedProjectFilter[] = [];
	personalDashboardLayout: PersonalDashboardCardLayout[] = [];
	personalDashboardSettings: PersonalDashboardSettings = normalizePersonalDashboardSettings();
	projectViewDisplay: ProjectViewDisplaySettings = normalizeProjectViewDisplay();
	dataIssues: PathIssue[] = [];
	pendingMigrations: MigrationJournalState[] = [];
	private readonly vault: ObsidianVaultAdapter;
	private readonly taskRepository: TaskRepository;
	private listeners = new Set<() => void>();
	private protectedByPath = new Map<string, ProtectedIdentity>();
	private authorizedIdentities = new Map<string, ProtectedIdentity>();
	private baseDataIssues: PathIssue[] = [];
	private taskIssuesByPath = new Map<string, PathIssue[]>();

	constructor(
		readonly app: App,
		private readonly configStore: ConfigurationStore,
		private readonly legacyGlobalConfigPath = DEFAULT_GLOBAL_CONFIG_PATH,
	) {
		this.vault = new ObsidianVaultAdapter(app);
		this.taskRepository = new TaskRepository(this.vault);
	}

	async initialize(): Promise<void> {
		const snapshot = await loadOrMigrateConfiguration(
			this.configStore,
			() => this.loadLegacyConfiguration(),
		);
		this.applyConfiguration(snapshot);
		await this.reload();
	}

	async reload(): Promise<void> {
		this.baseDataIssues = [];
		this.taskIssuesByPath.clear();
		const snapshot = await this.configStore.load();
		if (!snapshot) throw new Error('插件配置数据不存在。');
		this.applyConfiguration(snapshot);
		const customKeys = new Set(this.projects.flatMap((project) => project.customFields.map((field) => field.key)));
		const tasks: IndexedTask[] = [];
		for (const path of await this.taskRepository.listPaths()) {
			const task = await this.parseIndexedTask(path, customKeys);
			if (task) tasks.push(task);
		}
		this.index.replace(tasks);
		const repairedTagStyles = repairMalformedTagStyles(
			this.tagStyles,
			new Set(tasks.flatMap((task) => task.document.metadata.tags)),
		);
		if (JSON.stringify(repairedTagStyles) !== JSON.stringify(this.tagStyles)) {
			this.tagStyles = repairedTagStyles;
			await this.persistConfiguration();
		}
		this.protectedByPath = new Map(tasks.map((task) => [task.path, { uid: task.document.metadata.uid, key: task.document.metadata.key }]));
		this.rebuildDataIssues();
		this.pendingMigrations = await MigrationJournal.listIncomplete(this.vault);
		for (const listener of this.listeners) listener();
	}

	async refreshPaths(paths: readonly string[]): Promise<void> {
		const customKeys = new Set(this.projects.flatMap((project) => project.customFields.map((field) => field.key)));
		for (const path of new Set(paths)) {
			if (!path.endsWith('.md') || !(await this.vault.exists(path))) {
				this.index.remove(path);
				this.protectedByPath.delete(path);
				this.taskIssuesByPath.delete(path);
				continue;
			}
			const source = await this.vault.read(path);
			if (!/^---[\s\S]*?^pm-kind:\s*task\s*$/mu.test(source)) {
				this.index.remove(path);
				this.protectedByPath.delete(path);
				this.taskIssuesByPath.delete(path);
				continue;
			}
			const task = await this.parseIndexedTask(path, customKeys, source);
			if (task) {
				this.index.upsert(task);
				this.protectedByPath.set(path, { uid: task.document.metadata.uid, key: task.document.metadata.key });
			} else {
				this.index.remove(path);
			}
		}
		this.rebuildDataIssues();
		this.pendingMigrations = await MigrationJournal.listIncomplete(this.vault);
		for (const listener of this.listeners) listener();
	}

	private async parseIndexedTask(
		path: string,
		customKeys: ReadonlySet<string>,
		source?: string,
	): Promise<IndexedTask | null> {
		const parsed = parseTaskMarkdown(source ?? await this.vault.read(path), { customFieldKeys: customKeys });
		const snapshot = this.protectedByPath.get(path);
		const pathIssues: PathIssue[] = [];
		let restored = false;
		if (parsed.document) {
			const authorized = this.authorizedIdentities.get(path);
			if (authorized) {
				const reconciliation = reconcileProtectedIdentity(
					parsed.document.metadata,
					snapshot ?? parsed.document.metadata,
					authorized,
				);
				if (reconciliation.authorizationComplete) this.authorizedIdentities.delete(path);
			} else if (snapshot) {
				restored = reconcileProtectedIdentity(parsed.document.metadata, snapshot).changed;
			}
		}
		const effectiveIssues = restored
			? parsed.issues.filter((issue) => issue.code !== 'invalid-uuid' && issue.code !== 'invalid-key')
			: parsed.issues;
		for (const issue of effectiveIssues) pathIssues.push({ path, issue });
		if (!parsed.document || effectiveIssues.length > 0) {
			this.setTaskIssues(path, pathIssues);
			return null;
		}
		const project = this.projects.find((item) => item.uid === parsed.document!.metadata.projectUid);
		if (!project) {
			pathIssues.push({ path, issue: { code: 'orphan-task', path: 'project-uid', message: '找不到任务所属项目。' } });
			this.setTaskIssues(path, pathIssues);
			return null;
		}
		const referenceIssues = validateTaskReferences(
			parsed.document.metadata,
			project,
			new Set(this.globalConfig.people.map((person) => person.id)),
		);
		for (const issue of referenceIssues) pathIssues.push({ path, issue });
		if (referenceIssues.length > 0) {
			this.setTaskIssues(path, pathIssues);
			return null;
		}
		if (restored) {
			await this.taskRepository.save(path, parsed.document, project);
			pathIssues.push({ path, issue: { code: 'protected-fields-restored', path: 'uid,key', message: '已恢复被直接修改的 UUID 和 Key。' } });
		}
		this.setTaskIssues(path, pathIssues);
		return { path, document: parsed.document, project };
	}

	private setTaskIssues(path: string, issues: PathIssue[]): void {
		if (issues.length > 0) this.taskIssuesByPath.set(path, issues);
		else this.taskIssuesByPath.delete(path);
	}

	private rebuildDataIssues(): void {
		this.dataIssues = [
			...this.baseDataIssues,
			...[...this.taskIssuesByPath.values()].flat(),
			...collectTaskDataIssues(this.index.validTasks()),
		];
		for (const issue of this.index.issues()) {
			for (const path of issue.paths) this.dataIssues.push({ path, issue });
		}
	}

	private async loadLegacyConfiguration() {
		if (!(await this.vault.exists(this.legacyGlobalConfigPath))) {
			return { snapshot: defaultConfiguration(), cleanup: async () => undefined };
		}
		const globalRepository = new GlobalConfigRepository(this.vault, this.legacyGlobalConfigPath);
		const globalConfig = await globalRepository.read();
		const projectRepository = new ProjectRepository(this.vault, globalConfig.projectConfigDirectory);
		const projectFiles = await projectRepository.list();
		const invalid = projectFiles.filter((file) => !file.config || file.issues.length > 0);
		if (invalid.length > 0) throw new Error('旧项目配置存在校验问题，迁移已停止且原文件已保留。');
		const snapshot: ConfigurationSnapshot = {
			globalConfig,
			projects: projectFiles.flatMap((file) => file.config ? [file.config] : []),
			tagOrder: [],
		};
		return {
			snapshot,
			cleanup: async () => {
				for (const file of projectFiles) await this.vault.trash(file.path);
				await this.vault.trash(this.legacyGlobalConfigPath);
			},
		};
	}

	private applyConfiguration(snapshot: ConfigurationSnapshot): void {
		const normalized = normalizeConfigurationSnapshot(snapshot);
		const customFields = this.configurationCustomFields(normalized.projects);
		this.globalConfig = structuredClone(normalized.globalConfig);
		this.projects = structuredClone(normalized.projects);
		this.tagOrder = [...normalized.tagOrder];
		this.tagStyles = structuredClone(normalized.tagStyles);
		this.tagGroups = structuredClone(normalized.tagGroups);
		this.tagGroupAssignments = structuredClone(normalized.tagGroupAssignments);
		this.taskTemplates = structuredClone(normalized.taskTemplates);
		this.savedProjectFilters = structuredClone(normalized.savedProjectFilters);
		this.personalDashboardLayout = normalizeDashboardLayout(normalized.personalDashboardLayout, customFields);
		this.personalDashboardSettings = normalizePersonalDashboardSettings(normalized.personalDashboardSettings);
		this.projectViewDisplay = normalizeProjectViewDisplay(normalized.projectViewDisplay, customFields);
	}

	private configurationCustomFields(projects = this.projects) {
		return [...new Map(projects.flatMap((project) => project.customFields).map((field) => [field.key, field])).values()];
	}

	private snapshot(): ConfigurationSnapshot {
		return {
			globalConfig: structuredClone(this.globalConfig),
			projects: structuredClone(this.projects),
			tagOrder: [...this.tagOrder],
			tagStyles: structuredClone(this.tagStyles),
			tagGroups: structuredClone(this.tagGroups),
			tagGroupAssignments: structuredClone(this.tagGroupAssignments),
			taskTemplates: structuredClone(this.taskTemplates),
			savedProjectFilters: structuredClone(this.savedProjectFilters),
			personalDashboardLayout: structuredClone(this.personalDashboardLayout),
			personalDashboardSettings: normalizePersonalDashboardSettings(this.personalDashboardSettings),
			projectViewDisplay: normalizeProjectViewDisplay(this.projectViewDisplay, this.configurationCustomFields()),
		};
	}

	private async persistConfiguration(): Promise<void> {
		await this.configStore.save(this.snapshot());
	}

	private replaceProject(project: ProjectConfig): void {
		const index = this.projects.findIndex((item) => item.uid === project.uid);
		if (index < 0) this.projects.push(structuredClone(project));
		else this.projects[index] = structuredClone(project);
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	async createProject(code: string, name: string): Promise<void> {
		const normalizedCode = code.trim().toUpperCase();
		if (this.projects.some((project) => project.code === normalizedCode)) {
			throw new Error('项目代码已存在。');
		}
		const project = defaultProject(
			normalizedCode,
			name.trim(),
			`${this.globalConfig.defaultTaskDirectory}/${normalizedCode}`,
		);
		this.projects.push(project);
		await this.persistConfiguration();
		await this.reload();
	}

	async saveGlobalConfig(): Promise<void> {
		const validation = validateGlobalConfig(this.globalConfig);
		if (!validation.success) throw new Error(validation.issues.map((issue) => issue.message).join('\n'));
		await this.persistConfiguration();
		await this.reload();
	}

	async saveProject(project: ProjectConfig): Promise<void> {
		const validation = validateProjectConfig(project);
		if (!validation.success) throw new Error(validation.issues.map((issue) => issue.message).join('\n'));
		this.replaceProject(project);
		await this.persistConfiguration();
		await this.reload();
	}

	async saveTaskTemplate(template: TaskConfigurationTemplate): Promise<void> {
		if (!template.name.trim()) throw new Error('模板名称不能为空。');
		if (template.taskTypes.length === 0) throw new Error('模板至少需要一个任务类型。');
		const next = structuredClone(template);
		const index = this.taskTemplates.findIndex((item) => item.id === next.id);
		if (index < 0) this.taskTemplates.push(next);
		else this.taskTemplates[index] = next;
		this.projects = this.projects.map((project) => {
			const ids = project.templateIds ?? (project.templateId ? [project.templateId] : []);
			if (!ids.includes(next.id)) return project;
			const templates = ids.map((id) => this.taskTemplates.find((item) => item.id === id)).filter((item): item is TaskConfigurationTemplate => item !== undefined);
			return applyConfigurationTemplates(project, templates);
		});
		await this.persistConfiguration();
		await this.reload();
	}

	async deleteTaskTemplate(templateId: string): Promise<void> {
		if (this.projects.some((project) => (project.templateIds ?? (project.templateId ? [project.templateId] : [])).includes(templateId))) {
			throw new Error('仍有项目启用该模板，不能删除。');
		}
		this.taskTemplates = this.taskTemplates.filter((template) => template.id !== templateId);
		await this.persistConfiguration();
		await this.reload();
	}

	async applyTemplateToProject(project: ProjectConfig, templateId: string): Promise<void> {
		const template = this.taskTemplates.find((item) => item.id === templateId);
		if (!template) throw new Error('任务模板不存在。');
		await this.saveProject(applyConfigurationTemplate(project, template));
	}

	async applyTemplatesToProject(project: ProjectConfig, templateIds: readonly string[]): Promise<void> {
		const templates = templateIds.map((id) => this.taskTemplates.find((item) => item.id === id)).filter((item): item is TaskConfigurationTemplate => item !== undefined);
		if (templates.length !== templateIds.length) throw new Error('部分任务模板不存在。');
		await this.saveProject(applyConfigurationTemplates(project, templates));
	}

	async savePersonalDashboardLayout(layout: readonly PersonalDashboardCardLayout[]): Promise<void> {
		this.personalDashboardLayout = normalizeDashboardLayout(layout, this.configurationCustomFields());
		await this.persistConfiguration();
	}

	async savePersonalDashboardSettings(settings: PersonalDashboardSettings): Promise<void> {
		this.personalDashboardSettings = normalizePersonalDashboardSettings(settings);
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async saveProjectViewDisplay(settings: ProjectViewDisplaySettings): Promise<void> {
		this.projectViewDisplay = normalizeProjectViewDisplay(settings, this.configurationCustomFields());
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async saveProjectFilter(filter: SavedProjectFilter): Promise<void> {
		const next = structuredClone(filter);
		const index = this.savedProjectFilters.findIndex((item) => item.id === next.id);
		if (index < 0) this.savedProjectFilters.push(next);
		else this.savedProjectFilters[index] = next;
		await this.persistConfiguration();
	}

	async deleteProjectFilter(filterId: string): Promise<void> {
		this.savedProjectFilters = this.savedProjectFilters.filter((item) => item.id !== filterId);
		await this.persistConfiguration();
	}

	async deleteProject(project: ProjectConfig): Promise<void> {
		const issues = validateProjectDeletion(
			project.uid,
			this.index.validTasks().map((task) => task.document),
		);
		if (issues.length > 0) throw new Error(issues[0]!.message);
		this.projects = this.projects.filter((item) => item.uid !== project.uid);
		await this.persistConfiguration();
		await this.reload();
	}

	async renameCustomFieldKey(
		project: ProjectConfig,
		fieldId: string,
		newKey: string,
	): Promise<void> {
		const field = project.customFields.find((item) => item.id === fieldId);
		if (!field) throw new Error('自定义字段不存在。');
		if (field.key === newKey) return;
		const entries = this.index.validTasks().filter((task) => task.project.uid === project.uid);
		const changed = changeCustomFieldKey(entries.map((entry) => entry.document), field.key, newKey);
		const journal = new MigrationJournal(this.vault, createUuid());
		await journal.create(
			'custom-field-key',
			entries.map((entry, index) => ({
				uid: entry.document.metadata.uid,
				oldPath: entry.path,
				newPath: entry.path,
				oldKey: entry.document.metadata.key,
				newKey: entry.document.metadata.key,
				projectUid: project.uid,
				document: changed[index]!,
				baseline: entry.document,
				removedCustomKeys: [field.key],
			})),
			{ type: 'custom-field-key', projectUid: project.uid, fieldId, newKey },
		);
		for (const [index, document] of changed.entries()) {
			const entry = entries[index]!;
			await this.taskRepository.save(entry.path, document, project);
			await journal.complete(entry.document.metadata.uid);
		}
		field.key = newKey;
		this.replaceProject(project);
		await this.persistConfiguration();
		await journal.completeFinalization();
		await this.reload();
	}

	async changeProjectCode(project: ProjectConfig, newCode: string): Promise<void> {
		const entries = this.index.validTasks().filter((task) => task.project.uid === project.uid);
		const otherKeys = new Set(this.index.validTasks().filter((task) => task.project.uid !== project.uid).map((task) => task.document.metadata.key));
		const plan = planProjectCodeMigration(project, entries, newCode, otherKeys);
		if (plan.issues.length > 0) throw new Error(plan.issues[0]!.message);
		for (const change of plan.changes) {
			if (change.oldPath !== change.newPath && await this.vault.exists(change.newPath)) {
				throw new Error(`目标文件已存在：${change.newPath}`);
			}
		}
		const keyByUid = new Map(plan.changes.map((change) => [change.document.metadata.uid, change.newKey]));
		const externalEntries = this.index.validTasks().filter((task) => task.project.uid !== project.uid && task.document.relations.some((relation) => keyByUid.has(relation.targetUid)));
		const refreshed = refreshRelationKeys(externalEntries.map((entry) => entry.document), keyByUid);
		const nextProject = structuredClone(project);
		const oldCode = nextProject.code;
		nextProject.code = newCode.trim().toUpperCase();
		if (nextProject.taskDirectory.endsWith(`/${oldCode}`)) {
			nextProject.taskDirectory = `${nextProject.taskDirectory.slice(0, -oldCode.length)}${nextProject.code}`;
		}
		const oldPath = `config:${project.uid}`;
		const newPath = oldPath;
		const entriesByUid = new Map(entries.map((entry) => [entry.document.metadata.uid, entry]));
		const journal = new MigrationJournal(this.vault, createUuid());
		await journal.create(
			'project-code',
			[
				...plan.changes.map((change) => ({
					uid: change.document.metadata.uid,
					oldPath: change.oldPath,
					newPath: change.newPath,
					oldKey: change.oldKey,
					newKey: change.newKey,
					projectUid: project.uid,
					document: change.document,
					baseline: entriesByUid.get(change.document.metadata.uid)!.document,
				})),
				...externalEntries.map((entry, index) => ({
					uid: entry.document.metadata.uid,
					oldPath: entry.path,
					newPath: entry.path,
					oldKey: entry.document.metadata.key,
					newKey: entry.document.metadata.key,
					projectUid: entry.project.uid,
					document: refreshed[index]!,
					baseline: entry.document,
				})),
			],
			{ type: 'project-code', projectUid: project.uid, oldPath, newPath, project: nextProject },
		);
		for (const change of plan.changes) {
			this.authorizedIdentities.set(change.newPath, {
				uid: change.document.metadata.uid,
				key: change.document.metadata.key,
			});
			if (change.oldPath !== change.newPath) {
				await this.taskRepository.rename(change.oldPath, change.newPath);
			}
			await this.taskRepository.save(change.newPath, change.document, project);
			await journal.complete(change.document.metadata.uid);
		}
		for (const [index, document] of refreshed.entries()) {
			const entry = externalEntries[index]!;
			await this.taskRepository.save(entry.path, document, entry.project);
			await journal.complete(entry.document.metadata.uid);
		}
		this.replaceProject(nextProject);
		await this.persistConfiguration();
		await journal.completeFinalization();
		await this.reload();
	}

	async transferTask(
		entry: IndexedTask,
		target: ProjectConfig,
		mapping: TransferMapping,
	): Promise<void> {
		if (entry.document.relations.some((relation) => relation.type === 'parent') || this.index.childrenOf(entry.document.metadata.uid).length > 0) {
			throw new Error('存在父子关系的任务必须先解除关系或迁移整棵任务树。');
		}
		const existingKeys = new Set(this.index.validTasks().map((task) => task.document.metadata.key));
		const prepared = prepareProjectTransfer(entry.document, target, mapping, existingKeys);
		this.authorizedIdentities.set(prepared.path, {
			uid: prepared.document.metadata.uid,
			key: prepared.document.metadata.key,
		});
		if (await this.vault.exists(prepared.path)) throw new Error(`目标文件已存在：${prepared.path}`);
		const keyByUid = new Map([[entry.document.metadata.uid, prepared.document.metadata.key]]);
		const externalEntries = this.index.validTasks().filter((task) => task.document.metadata.uid !== entry.document.metadata.uid && task.document.relations.some((relation) => keyByUid.has(relation.targetUid)));
		const refreshed = refreshRelationKeys(externalEntries.map((task) => task.document), keyByUid);
		const journal = new MigrationJournal(this.vault, createUuid());
		await journal.create('task-transfer', [
			{
				uid: entry.document.metadata.uid,
				oldPath: entry.path,
				newPath: prepared.path,
				oldKey: entry.document.metadata.key,
				newKey: prepared.document.metadata.key,
				projectUid: target.uid,
				document: prepared.document,
				baseline: entry.document,
				details: {
					discardedCustomFields: Object.fromEntries(
						Object.entries(entry.document.metadata.custom).filter(([key]) => !(key in mapping.customFieldMappings)),
					),
				},
			},
			...externalEntries.map((task, index) => ({
				uid: task.document.metadata.uid,
				oldPath: task.path,
				newPath: task.path,
				oldKey: task.document.metadata.key,
				newKey: task.document.metadata.key,
				projectUid: task.project.uid,
				document: refreshed[index]!,
				baseline: task.document,
			})),
		]);
		target.nextNumber = prepared.nextNumber;
		this.replaceProject(target);
		await this.persistConfiguration();
		await this.taskRepository.rename(entry.path, prepared.path);
		await this.taskRepository.save(prepared.path, prepared.document, target);
		await journal.complete(entry.document.metadata.uid);
		for (const [index, document] of refreshed.entries()) {
			const external = externalEntries[index]!;
			await this.taskRepository.save(external.path, document, external.project);
			await journal.complete(external.document.metadata.uid);
		}
		await this.reload();
	}

	async transferTaskTree(
		entry: IndexedTask,
		target: ProjectConfig,
		mapping: TransferMapping,
	): Promise<void> {
		const entries = collectTaskTree(entry.document.metadata.uid, this.index);
		if (entries.length === 0) throw new Error('找不到任务树。');
		const existingKeys = new Set(this.index.validTasks().map((task) => task.document.metadata.key));
		let nextNumber = target.nextNumber;
		const prepared = entries.map((item) => {
			const result = prepareProjectTransfer(item.document, target, mapping, existingKeys, nextNumber);
			nextNumber = result.nextNumber;
			existingKeys.add(result.document.metadata.key);
			return { entry: item, ...result };
		});
		const keyByUid = new Map(prepared.map((item) => [item.document.metadata.uid, item.document.metadata.key]));
		const refreshed = refreshRelationKeys(prepared.map((item) => item.document), keyByUid);
		const movedUids = new Set(prepared.map((item) => item.document.metadata.uid));
		const externalEntries = this.index.validTasks().filter((task) => !movedUids.has(task.document.metadata.uid) && task.document.relations.some((relation) => keyByUid.has(relation.targetUid)));
		const refreshedExternal = refreshRelationKeys(externalEntries.map((task) => task.document), keyByUid);
		for (const item of prepared) {
			if (item.entry.path !== item.path && await this.vault.exists(item.path)) throw new Error(`目标文件已存在：${item.path}`);
		}
		const journal = new MigrationJournal(this.vault, createUuid());
		await journal.create('task-tree-transfer', [
			...prepared.map((item, index) => ({
				uid: item.document.metadata.uid,
				oldPath: item.entry.path,
				newPath: item.path,
				oldKey: item.entry.document.metadata.key,
				newKey: item.document.metadata.key,
				projectUid: target.uid,
				document: refreshed[index]!,
				baseline: item.entry.document,
				details: {
					discardedCustomFields: Object.fromEntries(
						Object.entries(item.entry.document.metadata.custom).filter(([key]) => !(key in mapping.customFieldMappings)),
					),
				},
			})),
			...externalEntries.map((task, index) => ({
				uid: task.document.metadata.uid,
				oldPath: task.path,
				newPath: task.path,
				oldKey: task.document.metadata.key,
				newKey: task.document.metadata.key,
				projectUid: task.project.uid,
				document: refreshedExternal[index]!,
				baseline: task.document,
			})),
		]);
		target.nextNumber = nextNumber;
		this.replaceProject(target);
		await this.persistConfiguration();
		for (const [index, item] of prepared.entries()) {
			this.authorizedIdentities.set(item.path, {
				uid: refreshed[index]!.metadata.uid,
				key: refreshed[index]!.metadata.key,
			});
			await this.taskRepository.rename(item.entry.path, item.path);
			await this.taskRepository.save(item.path, refreshed[index]!, target);
			await journal.complete(item.document.metadata.uid);
		}
		for (const [index, document] of refreshedExternal.entries()) {
			const external = externalEntries[index]!;
			await this.taskRepository.save(external.path, document, external.project);
			await journal.complete(external.document.metadata.uid);
		}
		await this.reload();
	}

	async createTask(input: Omit<NewTaskInput, 'globalConfig'>): Promise<string> {
		const existingKeys = new Set(
			this.index.validTasks().map((task) => task.document.metadata.key),
		);
		const prepared = prepareNewTask(
			{ ...input, globalConfig: this.globalConfig },
			existingKeys,
		);
		input.project.nextNumber = prepared.nextNumber;
		this.replaceProject(input.project);
		await this.persistConfiguration();
		await this.taskRepository.create(prepared.path, prepared.document);
		await this.reload();
		return prepared.path;
	}

	async saveTask(entry: IndexedTask, document: TaskDocument): Promise<void> {
		const validation = validateTaskMetadata(document.metadata);
		const referenceIssues = validateTaskReferences(
			document.metadata,
			entry.project,
			new Set(this.globalConfig.people.map((person) => person.id)),
		);
		const issues = [...validation.issues, ...referenceIssues];
		if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join('\n'));
		await this.taskRepository.save(entry.path, document, entry.project, entry.document);
		await this.reload();
	}

	async renameTag(oldPath: string, newPath: string): Promise<void> {
		const entries = this.index.validTasks().filter((task) =>
			task.document.metadata.tags.some((tag) => tag === oldPath || tag.startsWith(`${oldPath}/`)),
		);
		const changed = entries.map((entry) => {
			const document = structuredClone(entry.document);
			document.metadata.tags = renameTagPath(document.metadata.tags, oldPath, newPath);
			return document;
		});
		const journal = new MigrationJournal(this.vault, createUuid());
		await journal.create('tag-rename', entries.map((entry, index) => ({
			uid: entry.document.metadata.uid,
			oldPath: entry.path,
			newPath: entry.path,
			oldKey: entry.document.metadata.key,
			newKey: entry.document.metadata.key,
			projectUid: entry.project.uid,
			document: changed[index]!,
			baseline: entry.document,
		})));
		for (const [index, entry] of entries.entries()) {
			await this.taskRepository.save(entry.path, changed[index]!, entry.project, entry.document);
			await journal.complete(entry.document.metadata.uid);
		}
		this.tagOrder = renameTagPath(this.tagOrder, oldPath, newPath);
		this.tagStyles = renameTagStyles(this.tagStyles, oldPath, newPath);
		this.tagGroupAssignments = renameTagGroupAssignments(this.tagGroupAssignments, oldPath, newPath);
		await this.persistConfiguration();
		await this.reload();
	}

	async saveTagOrder(order: readonly string[]): Promise<void> {
		this.tagOrder = [...new Set(order)];
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async saveTagStyle(tagPath: string, style: TagStyle): Promise<void> {
		const normalizedPath = tagPath.trim().replace(/^#|\/$/gu, '');
		if (!normalizedPath) throw new Error('标签路径不能为空。');
		const normalizedStyle = {
			icon: style.icon?.trim() || undefined,
			color: style.color?.trim() || undefined,
		};
		if (!normalizedStyle.icon && !normalizedStyle.color) delete this.tagStyles[normalizedPath];
		else this.tagStyles[normalizedPath] = normalizedStyle;
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async moveTagStyle(oldPath: string, newPath: string): Promise<void> {
		this.tagStyles = moveTagStylePath(this.tagStyles, oldPath, newPath);
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async saveTagGroup(group: TagGroup): Promise<void> {
		const next = { ...structuredClone(group), name: group.name.trim() };
		if (!next.name) throw new Error('标签分组名称不能为空。');
		const index = this.tagGroups.findIndex((item) => item.id === next.id);
		if (index < 0) this.tagGroups.push(next);
		else this.tagGroups[index] = next;
		this.tagGroups = this.tagGroups
			.sort((left, right) => left.order - right.order)
			.map((item, order) => ({ ...item, order }));
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async deleteTagGroup(groupId: string): Promise<void> {
		this.tagGroups = this.tagGroups.filter((group) => group.id !== groupId).map((group, order) => ({ ...group, order }));
		this.tagGroupAssignments = removeTagGroupAssignments(this.tagGroupAssignments, groupId);
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async assignTagGroup(tagPath: string, groupId: string | null): Promise<void> {
		const root = rootTagPath(tagPath);
		if (groupId && !this.tagGroups.some((group) => group.id === groupId)) throw new Error('标签分组不存在。');
		if (groupId) this.tagGroupAssignments[root] = groupId;
		else delete this.tagGroupAssignments[root];
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	orderTags(tags: readonly string[]): string[] {
		const rank = new Map(this.tagOrder.map((tag, index) => [tag, index]));
		return [...tags].sort((left, right) => {
			const leftRank = rank.get(left) ?? Number.MAX_SAFE_INTEGER;
			const rightRank = rank.get(right) ?? Number.MAX_SAFE_INTEGER;
			return leftRank === rightRank ? left.localeCompare(right, 'zh-CN') : leftRank - rightRank;
		});
	}

	async deleteTask(entry: IndexedTask): Promise<void> {
		const plan = planTaskDeletion(entry, this.index);
		if (plan.issues.length > 0) throw new Error(plan.issues[0]!.message);
		for (const edit of plan.relatedEdits) {
			await this.taskRepository.save(edit.path, edit.document, edit.project);
		}
		await this.taskRepository.trash(entry.path);
		await this.reload();
	}

	async repairIssue(path: string, code: string): Promise<void> {
		const entry = this.index.validTasks().find((task) => task.path === path);
		if (entry && code === 'filename-key-mismatch') {
			const directory = path.split('/').slice(0, -1).join('/');
			await this.taskRepository.rename(path, `${directory}/${entry.document.metadata.key}.md`);
		} else if (entry && code === 'relation-target-missing') {
			const document = structuredClone(entry.document);
			document.relations = document.relations.filter((relation) => this.index.get(relation.targetUid));
			await this.taskRepository.save(path, document, entry.project);
		} else if (code === 'duplicate-key' || code === 'duplicate-uuid' || code === 'missing-section') {
			const parsed = parseTaskMarkdown(await this.vault.read(path), {
				customFieldKeys: new Set(this.projects.flatMap((project) => project.customFields.map((field) => field.key))),
			});
			if (!parsed.document) throw new Error('任务文件无法解析。');
			const project = this.projects.find((item) => item.uid === parsed.document?.metadata.projectUid);
			if (!project) throw new Error('找不到任务所属项目。');
			if (code === 'duplicate-uuid') {
				parsed.document.metadata.uid = createUuid();
				this.authorizedIdentities.set(path, {
					uid: parsed.document.metadata.uid,
					key: parsed.document.metadata.key,
				});
			}
			if (code === 'duplicate-key') {
				const keys = new Set<string>();
				for (const taskPath of await this.taskRepository.listPaths()) {
					const task = parseTaskMarkdown(await this.vault.read(taskPath)).document;
					if (task) keys.add(task.metadata.key);
				}
				let number = project.nextNumber;
				while (keys.has(`${project.code}-${number}`)) number += 1;
				parsed.document.metadata.key = `${project.code}-${number}`;
				project.nextNumber = number + 1;
				this.replaceProject(project);
				await this.persistConfiguration();
				const directory = path.split('/').slice(0, -1).join('/');
				const nextPath = `${directory}/${parsed.document.metadata.key}.md`;
				this.authorizedIdentities.set(nextPath, {
					uid: parsed.document.metadata.uid,
					key: parsed.document.metadata.key,
				});
				await this.taskRepository.rename(path, nextPath);
				path = nextPath;
			}
			await this.taskRepository.save(path, parsed.document, project);
		} else {
			throw new Error('该问题需要在 Markdown 中手动修复。');
		}
		await this.reload();
	}

	async resumeMigration(id: string): Promise<void> {
		const state = (await MigrationJournal.listIncomplete(this.vault)).find((item) => item.id === id);
		if (!state) throw new Error('找不到未完成的迁移。');
		const journal = new MigrationJournal(this.vault, id);
		const projectsToSave = new Map<string, ProjectConfig>();
		for (const item of state.items.filter((candidate) => !candidate.completed)) {
			if (!item.document || !item.baseline || !item.projectUid) {
				throw new Error('该迁移日志来自旧版本，缺少安全继续所需的任务快照，请手动检查文件。');
			}
			const project = this.projects.find((candidate) => candidate.uid === item.projectUid);
			if (!project) throw new Error(`迁移目标项目不存在：${item.projectUid}`);
			const match = item.newKey?.match(new RegExp(`^${project.code}-(\\d+)$`, 'u'));
			if (match) {
				const nextNumber = Number(match[1]) + 1;
				if (nextNumber > project.nextNumber) {
					project.nextNumber = nextNumber;
					projectsToSave.set(project.uid, project);
				}
			}
		}
		for (const project of projectsToSave.values()) this.replaceProject(project);
		if (projectsToSave.size > 0) await this.persistConfiguration();
		for (const item of state.items.filter((candidate) => !candidate.completed)) {
			const project = this.projects.find((candidate) => candidate.uid === item.projectUid)!;
			const oldExists = await this.vault.exists(item.oldPath);
			const newExists = item.oldPath === item.newPath ? oldExists : await this.vault.exists(item.newPath);
			const action = resolveMigrationPath(item.oldPath, item.newPath, oldExists, newExists);
			this.authorizedIdentities.set(item.newPath, {
				uid: item.document!.metadata.uid,
				key: item.document!.metadata.key,
			});
			if (action.rename) await this.taskRepository.rename(action.path, item.newPath);
			await this.taskRepository.save(item.newPath, structuredClone(item.document!), project, item.baseline);
			await journal.complete(item.uid);
		}
		if (state.finalization && state.finalized !== true) {
			const finalization = state.finalization;
			if (finalization.type === 'custom-field-key') {
				const project = this.projects.find((candidate) => candidate.uid === finalization.projectUid);
				const field = project?.customFields.find((candidate) => candidate.id === finalization.fieldId);
				if (!project || !field) throw new Error('无法完成自定义字段键迁移：项目或字段不存在。');
				field.key = finalization.newKey;
				this.replaceProject(project);
				await this.persistConfiguration();
			} else {
				this.replaceProject(finalization.project);
				await this.persistConfiguration();
			}
			await journal.completeFinalization();
		}
		await this.reload();
	}

	async openTask(path: string): Promise<void> {
		const file = this.app.vault.getFileByPath(path);
		if (file) await this.app.workspace.getLeaf(false).openFile(file);
	}
}

function defaultConfiguration(): ConfigurationSnapshot {
	const userId = createUuid();
	return {
		globalConfig: {
			kind: 'global-config', schema: 1,
			projectConfigDirectory: 'plugin-data',
			defaultTaskDirectory: '项目管理/任务',
			currentUserId: userId,
			people: [{ id: userId, name: '默认用户', active: true }],
		},
		projects: [],
		tagOrder: [],
		tagStyles: {},
		tagGroups: [],
		tagGroupAssignments: {},
		taskTemplates: [],
		savedProjectFilters: [],
		personalDashboardLayout: [],
		personalDashboardSettings: normalizePersonalDashboardSettings(),
		projectViewDisplay: normalizeProjectViewDisplay(),
	};
}

function defaultProject(code: string, name: string, taskDirectory: string): ProjectConfig {
	return {
		kind: 'project', schema: 1, uid: createUuid(), code, name, active: true,
		taskDirectory, groupByMonth: true, nextNumber: 1,
		taskTypes: [
			{ id: 'task', name: '任务', icon: 'circle-check', color: '#3b82f6', marker: 'circle-check', titleColor: '#2563eb', active: true, template: null },
			{ id: 'bug', name: '缺陷', icon: 'bug', color: '#ef4444', marker: 'bug', titleColor: '#dc2626', active: true, template: null },
			{ id: 'requirement', name: '需求', icon: 'lightbulb', color: '#f59e0b', marker: '💡', titleColor: '#b45309', active: true, template: null },
		],
		customFields: [],
		workflow: {
			initialStatusId: 'waiting',
			statuses: [
				{ id: 'waiting', name: '待处理', category: 'todo', result: null, active: true },
				{ id: 'doing', name: '进行中', category: 'in_progress', result: null, active: true },
				{ id: 'completed', name: '已完成', category: 'done', result: 'completed', active: true },
				{ id: 'cancelled', name: '已取消', category: 'done', result: 'terminated', active: true },
			],
			transitions: [
				{ id: 'start', name: '开始处理', from: 'waiting', to: 'doing' },
				{ id: 'finish', name: '完成', from: 'doing', to: 'completed' },
				{ id: 'cancel-waiting', name: '取消', from: 'waiting', to: 'cancelled' },
				{ id: 'cancel-doing', name: '取消', from: 'doing', to: 'cancelled' },
				{ id: 'reopen-completed', name: '重新打开', from: 'completed', to: 'waiting' },
				{ id: 'reopen-cancelled', name: '重新打开', from: 'cancelled', to: 'waiting' },
			],
		},
	};
}
