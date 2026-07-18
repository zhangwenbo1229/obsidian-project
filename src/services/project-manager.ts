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
	EmbeddedSubtask,
	Person,
	PersonMetadataFieldDefinition,
} from '../domain/types';
import { validateGlobalConfig, validateProjectConfig, validateTaskReferences } from '../domain/validation';
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
import { type NewTaskInput } from './task-service';
import { type TransferMapping } from './migration-service';
import {
	loadOrMigrateConfiguration,
	type ConfigurationSnapshot,
	type ConfigurationStore,
} from '../settings/configuration-store';
import { repairMalformedTagStyles } from './tag-service';
import { applyConfigurationTemplate, applyConfigurationTemplates } from './template-service';
import { normalizeDashboardLayout } from '../views/dashboard-layout';
import { normalizeConfigurationSnapshot } from '../settings/configuration-store';
import { normalizeProjectViewDisplay, type ProjectViewDisplaySettings } from '../views/task-display-settings';
import { normalizePersonalDashboardSettings, type PersonalDashboardSettings } from '../views/personal-dashboard-settings';
import { mapConcurrent } from '../utils/async-pool';
import type { EmbeddedSubtaskInput } from './embedded-subtask-service';
import { normalizeTaskMetadataSettings, type TaskMetadataSettings } from '../settings/task-metadata-settings';
import { normalizePeopleSourceSettings, type PeopleSourceSettings } from './people-source';
import { normalizeNativeSidebarSettings, type NativeSidebarSettings, type PropertyGroupPresentation, type PropertyPresentation } from '../settings/native-sidebar-settings';
import type { PersonNamePresentation } from '../domain/types';
import { ConfigurationWriteQueue } from '../settings/configuration-write-queue';
import { DashboardVaultCache } from './dashboard-vault-cache';
import {
	configurationCustomFields,
	configurationWorkflowStatuses,
	createProjectManagerConfigurationSnapshot,
} from './project-manager-configuration';

import { TagManagerService } from './tag-manager-service';
import { PersonnelService } from './personnel-service';
import { MigrationManagerService } from './migration-manager-service';
import { TaskCrudService } from './task-crud-service';
import { createDefaultConfiguration, createDefaultProject } from './default-configuration';

export const DEFAULT_GLOBAL_CONFIG_PATH = '项目管理/全局配置.md';

export class ProjectManager {
	readonly tagManager: TagManagerService;
	readonly personnel: PersonnelService;
	readonly migrations: MigrationManagerService;
	readonly taskCrud: TaskCrudService;

	readonly index = new TaskIndex();
	readonly dashboardVaultCache: DashboardVaultCache;
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
	taskMetadataSettings: TaskMetadataSettings = normalizeTaskMetadataSettings();
	peopleSourceSettings: PeopleSourceSettings = normalizePeopleSourceSettings();
	nativeSidebarSettings: NativeSidebarSettings = normalizeNativeSidebarSettings();
	dataIssues: PathIssue[] = [];
	pendingMigrations: MigrationJournalState[] = [];
	readonly vault: ObsidianVaultAdapter;
	readonly taskRepository: TaskRepository;
	private listeners = new Set<() => void>();
	private protectedByPath = new Map<string, ProtectedIdentity>();
	authorizedIdentities = new Map<string, ProtectedIdentity>();
	private baseDataIssues: PathIssue[] = [];
	private taskIssuesByPath = new Map<string, PathIssue[]>();
	private dashboardFileOpenSave: Promise<void> = Promise.resolve();
	private taskIndexInitialization: Promise<void> | null = null;
	private taskIndexReady = false;
	private readonly configurationWrites: ConfigurationWriteQueue<ConfigurationSnapshot>;

	constructor(
		readonly app: App,
		private readonly configStore: ConfigurationStore,
		private readonly legacyGlobalConfigPath = DEFAULT_GLOBAL_CONFIG_PATH,
	) {
		this.vault = new ObsidianVaultAdapter(app);
		this.taskRepository = new TaskRepository(this.vault);
		this.dashboardVaultCache = new DashboardVaultCache(app.vault);
		this.configurationWrites = new ConfigurationWriteQueue((snapshot) => this.configStore.save(snapshot));
		this.tagManager = new TagManagerService(this);
		this.personnel = new PersonnelService(this);
		this.migrations = new MigrationManagerService(this);
		this.taskCrud = new TaskCrudService(this);
	}

	async initialize(): Promise<void> {
		await this.initializeConfiguration();
		await this.initializeTaskIndex();
	}

	async initializeConfiguration(): Promise<void> {
		const snapshot = await loadOrMigrateConfiguration(
			this.configStore,
			() => this.loadLegacyConfiguration(),
		);
		this.applyConfiguration(snapshot);
	}

	initializeTaskIndex(): Promise<void> {
		if (this.taskIndexInitialization) return this.taskIndexInitialization;
		if (this.taskIndexReady) return Promise.resolve();
		this.taskIndexInitialization ??= this.rebuildTaskIndex().finally(() => {
			this.taskIndexInitialization = null;
		});
		return this.taskIndexInitialization;
	}

	async reload(): Promise<void> {
		this.baseDataIssues = [];
		this.taskIssuesByPath.clear();
		const snapshot = await this.configStore.load();
		if (!snapshot) throw new Error('插件配置数据不存在。');
		this.applyConfiguration(snapshot);
		await this.rebuildTaskIndex();
	}

	private async rebuildTaskIndex(): Promise<void> {
		const customKeys = new Set(this.projects.flatMap((project) => project.customFields.map((field) => field.key)));
		const sources = await this.taskRepository.listSources(this.projects.map((project) => project.taskDirectory));
		const parsed = await mapConcurrent(sources, 8, ({ path, source }) => this.parseIndexedTask(path, customKeys, source));
		const tasks = parsed.filter((task): task is IndexedTask => task !== null);
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
		this.taskIndexReady = true;
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
			return { snapshot: createDefaultConfiguration(), cleanup: async () => undefined };
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
		this.projectViewDisplay = normalizeProjectViewDisplay(normalized.projectViewDisplay, customFields, this.configurationWorkflowStatuses());
		this.taskMetadataSettings = normalizeTaskMetadataSettings(normalized.taskMetadataSettings);
		this.peopleSourceSettings = normalizePeopleSourceSettings(normalized.peopleSourceSettings);
		this.nativeSidebarSettings = normalizeNativeSidebarSettings(normalized.nativeSidebarSettings);
	}

	private configurationCustomFields(projects = this.projects) {
		return configurationCustomFields(projects);
	}

	private configurationWorkflowStatuses(projects = this.projects) {
		return configurationWorkflowStatuses(projects);
	}

	private snapshot(): ConfigurationSnapshot {
		return createProjectManagerConfigurationSnapshot({
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
			projectViewDisplay: normalizeProjectViewDisplay(this.projectViewDisplay, this.configurationCustomFields(), this.configurationWorkflowStatuses()),
			taskMetadataSettings: normalizeTaskMetadataSettings(this.taskMetadataSettings),
			peopleSourceSettings: normalizePeopleSourceSettings(this.peopleSourceSettings),
			nativeSidebarSettings: normalizeNativeSidebarSettings(this.nativeSidebarSettings),
		});
	}

	async saveTaskMetadataSettings(settings: TaskMetadataSettings): Promise<void> {
		this.taskMetadataSettings = normalizeTaskMetadataSettings(settings);
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async savePeopleSourceSettings(settings: PeopleSourceSettings): Promise<void> {
		return this.personnel.savePeopleSourceSettings(settings);
	}

	async refreshPeopleFromMetadata(preferred?: Person): Promise<void> {
		return this.personnel.refreshPeopleFromMetadata(preferred);
	}

	async saveNativeSidebarSettings(settings: NativeSidebarSettings): Promise<void> {
		this.nativeSidebarSettings = normalizeNativeSidebarSettings(settings);
		await this.persistConfiguration();
		for (const listener of this.listeners) listener();
	}

	async savePropertyGroup(group: PropertyGroupPresentation): Promise<void> {
		const groups = this.nativeSidebarSettings.propertyGroups.filter((item) => item.id !== group.id);
		groups.push(group);
		await this.saveNativeSidebarSettings({ ...this.nativeSidebarSettings, propertyGroups: groups });
	}

	async deletePropertyGroup(groupId: string): Promise<void> {
		const propertyStyles = Object.fromEntries(Object.entries(this.nativeSidebarSettings.propertyStyles).map(([key, style]) => [key, style.groupId === groupId ? { ...style, groupId: undefined } : style]));
		await this.saveNativeSidebarSettings({ ...this.nativeSidebarSettings, propertyGroups: this.nativeSidebarSettings.propertyGroups.filter((group) => group.id !== groupId), propertyStyles });
	}

	async savePropertyStyle(key: string, style: PropertyPresentation): Promise<void> {
		await this.saveNativeSidebarSettings({ ...this.nativeSidebarSettings, propertyStyles: { ...this.nativeSidebarSettings.propertyStyles, [key]: style } });
	}

	configurationSnapshot(): ConfigurationSnapshot {
		return structuredClone(this.snapshot());
	}

	async replaceConfiguration(snapshot: ConfigurationSnapshot): Promise<void> {
		const previous = this.snapshot();
		const normalized = normalizeConfigurationSnapshot(snapshot);
		const globalValidation = validateGlobalConfig(normalized.globalConfig);
		const projectIssues = normalized.projects.flatMap((project) => validateProjectConfig(project).issues);
		const issues = [...globalValidation.issues, ...projectIssues];
		if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join('\n'));
		try {
			await this.configurationWrites.enqueue(normalized);
			const verified = await this.configStore.load();
			if (!verified || JSON.stringify(normalizeConfigurationSnapshot(verified)) !== JSON.stringify(normalized)) {
				throw new Error('导入配置写入后验证失败。');
			}
			this.applyConfiguration(normalized);
			await this.rebuildTaskIndex();
		} catch (error) {
			await this.configurationWrites.enqueue(previous);
			this.applyConfiguration(previous);
			await this.rebuildTaskIndex();
			throw error;
		}
	}

	async persistConfiguration(): Promise<void> {
		await this.configurationWrites.enqueue(this.snapshot());
	}

	replaceProject(project: ProjectConfig): void {
		const index = this.projects.findIndex((item) => item.uid === project.uid);
		if (index < 0) this.projects.push(structuredClone(project));
		else this.projects[index] = structuredClone(project);
	}

	notifyListeners(): void {
		for (const listener of this.listeners) listener();
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
		const project = createDefaultProject(
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

	async recordDashboardFileOpen(path: string): Promise<void> {
		const normalizedPath = path.trim();
		if (!normalizedPath) return;
		const current = this.personalDashboardSettings.fileOpenCounts[normalizedPath] ?? 0;
		this.personalDashboardSettings.fileOpenCounts[normalizedPath] = Math.min(1_000_000, current + 1);
		this.dashboardFileOpenSave = this.dashboardFileOpenSave
			.catch(() => undefined)
			.then(() => this.persistConfiguration());
		await this.dashboardFileOpenSave;
	}

	async saveProjectViewDisplay(settings: ProjectViewDisplaySettings): Promise<void> {
		this.projectViewDisplay = normalizeProjectViewDisplay(settings, this.configurationCustomFields(), this.configurationWorkflowStatuses());
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
		return this.migrations.renameCustomFieldKey(project, fieldId, newKey);
	}

	async changeProjectCode(project: ProjectConfig, newCode: string): Promise<void> {
		return this.migrations.changeProjectCode(project, newCode);
	}

	async transferTask(
		entry: IndexedTask,
		target: ProjectConfig,
		mapping: TransferMapping,
	): Promise<void> {
		return this.migrations.transferTask(entry, target, mapping);
	}

	async transferTaskTree(
		entry: IndexedTask,
		target: ProjectConfig,
		mapping: TransferMapping,
	): Promise<void> {
		return this.migrations.transferTaskTree(entry, target, mapping);
	}

	async createTask(input: Omit<NewTaskInput, 'globalConfig'>): Promise<string> {
		return this.taskCrud.create(input);
	}

	async saveTask(entry: IndexedTask, document: TaskDocument): Promise<void> {
		return this.taskCrud.save(entry, document);
	}

	async savePerson(person: Person): Promise<void> {
		return this.personnel.savePerson(person);
	}

	async deletePerson(personId: string): Promise<void> {
		return this.personnel.deletePerson(personId);
	}

	async savePersonNamePresentation(presentation: PersonNamePresentation): Promise<void> {
		return this.personnel.savePersonNamePresentation(presentation);
	}

	async savePersonMetadataFields(fields: readonly PersonMetadataFieldDefinition[]): Promise<void> {
		return this.personnel.savePersonMetadataFields(fields);
	}

	async addDashboardCheckIn(cardId: string, date: string, timestamp = new Date().toISOString()): Promise<void> {
		const history = this.personalDashboardSettings.checkInHistories[cardId] ?? {};
		const current = history[date] ?? [];
		this.personalDashboardSettings.checkInHistories[cardId] = { ...history, [date]: [...current, timestamp] };
		await this.savePersonalDashboardSettings(this.personalDashboardSettings);
	}

	embeddedSubtasks(entry: IndexedTask): EmbeddedSubtask[] {
		return this.taskCrud.embeddedSubtasks(entry);
	}

	async createEmbeddedSubtask(entry: IndexedTask, input: EmbeddedSubtaskInput): Promise<EmbeddedSubtask> {
		return this.taskCrud.createEmbeddedSubtask(entry, input);
	}

	async updateEmbeddedSubtask(entry: IndexedTask, subtask: EmbeddedSubtask): Promise<void> {
		return this.taskCrud.updateEmbeddedSubtask(entry, subtask);
	}

	async toggleEmbeddedSubtask(entry: IndexedTask, subtaskId: string, completed: boolean): Promise<void> {
		return this.taskCrud.toggleEmbeddedSubtask(entry, subtaskId, completed);
	}

	async deleteEmbeddedSubtask(entry: IndexedTask, subtaskId: string): Promise<void> {
		return this.taskCrud.deleteEmbeddedSubtask(entry, subtaskId);
	}

	async renameTag(oldPath: string, newPath: string): Promise<void> {
		return this.tagManager.renameTag(oldPath, newPath);
	}

	async saveTagOrder(order: readonly string[]): Promise<void> {
		return this.tagManager.saveTagOrder(order);
	}

	async saveTagStyle(tagPath: string, style: TagStyle): Promise<void> {
		return this.tagManager.saveTagStyle(tagPath, style);
	}

	async moveTagStyle(oldPath: string, newPath: string): Promise<void> {
		return this.tagManager.moveTagStyle(oldPath, newPath);
	}

	async saveTagGroup(group: TagGroup): Promise<void> {
		return this.tagManager.saveTagGroup(group);
	}

	async deleteTagGroup(groupId: string): Promise<void> {
		return this.tagManager.deleteTagGroup(groupId);
	}

	async assignTagGroup(tagPath: string, groupId: string | null): Promise<void> {
		return this.tagManager.assignTagGroup(tagPath, groupId);
	}

	orderTags(tags: readonly string[]): string[] {
		return this.tagManager.orderTags(tags);
	}

	async deleteTask(entry: IndexedTask): Promise<void> {
		return this.taskCrud.delete(entry);
	}

	async repairIssue(path: string, code: string): Promise<void> {
		return this.taskCrud.repairIssue(path, code);
	}

	async resumeMigration(id: string): Promise<void> {
		return this.migrations.resumeMigration(id);
	}

	async openTask(path: string): Promise<void> {
		const file = this.app.vault.getFileByPath(path);
		if (file) await this.app.workspace.getLeaf(false).openFile(file);
	}
}
