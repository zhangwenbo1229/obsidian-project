import { describe, expect, it } from 'vitest';
import type { ProjectConfig, TaskDocument } from '../../src/domain/types';
import {
	GlobalConfigRepository,
	ProjectRepository,
	TaskRepository,
	type VaultAdapter,
} from '../../src/repositories';
import { serializeEmbeddedSubtask } from '../../src/markdown/embedded-subtask-parser';

class MemoryVault implements VaultAdapter {
	files = new Map<string, string>();
	trashed: string[] = [];
	reads: string[] = [];

	async exists(path: string) {
		return this.files.has(path);
	}
	async read(path: string) {
		this.reads.push(path);
		const value = this.files.get(path);
		if (value === undefined) throw new Error(`Missing ${path}`);
		return value;
	}
	async create(path: string, content: string) {
		if (this.files.has(path)) throw new Error(`Exists ${path}`);
		this.files.set(path, content);
	}
	async process(path: string, update: (content: string) => string) {
		this.files.set(path, update(await this.read(path)));
	}
	async listMarkdownFiles() {
		return [...this.files.keys()].filter((path) => path.endsWith('.md'));
	}
	async listFiles(directory: string) { return [...this.files.keys()].filter((path) => path.startsWith(`${directory}/`)); }
	async rename(path: string, nextPath: string) {
		const content = await this.read(path);
		this.files.delete(path);
		this.files.set(nextPath, content);
	}
	async trash(path: string) {
		this.files.delete(path);
		this.trashed.push(path);
	}
	async ensureFolder() {}
}

const project: ProjectConfig = {
	kind: 'project', schema: 1,
	uid: '778de407-26bf-45ee-b22e-cf1f0bc826ce', code: 'PROJ', name: '项目', active: true,
	taskDirectory: '项目管理/任务/PROJ', groupByMonth: false, nextNumber: 2,
	taskTypes: [{ id: 'task', name: '任务', icon: 'check', color: '#000000', active: true, template: null }],
	customFields: [],
	workflow: {
		initialStatusId: 'waiting',
		statuses: [
			{ id: 'waiting', name: '待处理', category: 'todo', result: null, active: true },
			{ id: 'done', name: '完成', category: 'done', result: 'completed', active: true },
		],
		transitions: [{ id: 'finish', name: '完成', from: 'waiting', to: 'done' }],
	},
};

const task: TaskDocument = {
	metadata: {
		kind: 'task', schema: 1,
		uid: '550e8400-e29b-41d4-a716-446655440000', key: 'PROJ-1', projectUid: project.uid,
		title: '任务', taskTypeId: 'task', createdAt: '2026-07-12T14:30:00+08:00',
		startDate: null, dueDate: null, completedAt: null, terminatedAt: null,
		reporterId: '8a67a66f-0109-47b3-9463-5d05b4295949', assigneeId: null,
		statusId: 'waiting', tags: [], custom: {},
	},
	body: '正文', relations: [], notes: [], unknownFrontmatter: {}, unknownLinks: [], lineEnding: '\n',
};

describe('repositories', () => {
	it('creates and reads the global configuration', async () => {
		const vault = new MemoryVault();
		const repository = new GlobalConfigRepository(vault, '项目管理/全局配置.md');
		const config = {
			kind: 'global-config' as const, schema: 1 as const,
			projectConfigDirectory: '项目管理/项目配置', defaultTaskDirectory: '项目管理/任务',
			currentUserId: '8a67a66f-0109-47b3-9463-5d05b4295949',
			people: [{ id: '8a67a66f-0109-47b3-9463-5d05b4295949', name: '张三', active: true }],
			personMetadataFields: [],
		};

		await repository.create(config);

		expect(await repository.read()).toEqual(config);
	});

	it('discovers project files only inside the configured directory', async () => {
		const vault = new MemoryVault();
		const repository = new ProjectRepository(vault, '项目管理/项目配置');
		await repository.create(project);
		vault.files.set('其他/IGNORED.md', vault.files.values().next().value!);

		const projects = await repository.list();

		expect(projects).toHaveLength(1);
		expect(projects[0]?.config?.code).toBe('PROJ');
	});

	it('preserves unknown frontmatter added outside the plugin when saving', async () => {
		const vault = new MemoryVault();
		const repository = new TaskRepository(vault);
		await repository.create('项目管理/任务/PROJ/PROJ-1.md', task);
		const original = await vault.read('项目管理/任务/PROJ/PROJ-1.md');
		vault.files.set(
			'项目管理/任务/PROJ/PROJ-1.md',
			original.replace('status-id: waiting', 'status-id: waiting\nexternal: keep'),
		);
		task.metadata.title = '修改后的标题';

		await repository.save('项目管理/任务/PROJ/PROJ-1.md', task, project);

		const saved = await repository.read('项目管理/任务/PROJ/PROJ-1.md', project);
		expect(saved.document?.metadata.title).toBe('修改后的标题');
		expect(saved.document?.unknownFrontmatter['external']).toBe('keep');
	});

	it('renames and trashes through the vault adapter', async () => {
		const vault = new MemoryVault();
		const repository = new TaskRepository(vault);
		await repository.create('old.md', task);

		await repository.rename('old.md', 'new.md');
		await repository.trash('new.md');

		expect(vault.trashed).toEqual(['new.md']);
		expect(await vault.exists('new.md')).toBe(false);
	});

	it('discovers task sources only inside configured project directories', async () => {
		const vault = new MemoryVault();
		const repository = new TaskRepository(vault);
		await repository.create('项目管理/任务/PROJ/PROJ-1.md', task);
		vault.files.set('笔记/large.md', '# unrelated');
		vault.reads = [];
		const sources = await repository.listSources(['项目管理/任务/PROJ']);
		expect(sources.map((source) => source.path)).toEqual(['项目管理/任务/PROJ/PROJ-1.md']);
		expect(vault.reads).not.toContain('笔记/large.md');
	});

	it('does not scan the vault without configured project directories', async () => {
		const vault = new MemoryVault();
		vault.files.set('笔记/large.md', '# unrelated');
		const repository = new TaskRepository(vault);
		expect(await repository.listSources([])).toEqual([]);
		expect(vault.reads).toEqual([]);
	});

	it('keeps a concurrent body edit when the modal did not change the body', async () => {
		const vault = new MemoryVault();
		const repository = new TaskRepository(vault);
		const baseline = structuredClone(task);
		await repository.create('task.md', baseline);
		vault.files.set('task.md', (await vault.read('task.md')).replace('\n正文\n', '\n外部修改正文\n'));
		const edited = structuredClone(baseline);
		edited.metadata.title = '只修改标题';
		await repository.save('task.md', edited, project, baseline);
		const saved = await repository.read('task.md', project);
		expect(saved.document?.body).toBe('外部修改正文');
	});

	it('merges edited legacy subtasks with concurrently updated structured subtasks', async () => {
		const vault = new MemoryVault();
		const repository = new TaskRepository(vault);
		const baseline = structuredClone(task);
		baseline.subtasks = '- [ ] 原普通待办';
		await repository.create('task.md', baseline);
		const structured = serializeEmbeddedSubtask({
			id: '550e8400', title: '结构化子任务', completed: false,
			priority: 'high', scheduledDate: null, startDate: null, dueDate: null, tags: [],
			createdDate: '2026-07-15', doneDate: null, cancelledDate: null,
		});
		const current = structuredClone(baseline);
		current.subtasks = `- [ ] 原普通待办\n${structured}`;
		vault.files.set('task.md', (await vault.read('task.md')).replace('- [ ] 原普通待办', current.subtasks));
		const edited = structuredClone(baseline);
		edited.subtasks = '- [ ] 已编辑普通待办';
		await repository.save('task.md', edited, project, baseline);
		const saved = await repository.read('task.md', project);
		expect(saved.document?.subtasks).toContain('- [ ] 已编辑普通待办');
		expect(saved.document?.subtasks).toContain('结构化子任务');
	});

	it('removes renamed custom keys while preserving unrelated unknown frontmatter', async () => {
		const vault = new MemoryVault();
		const repository = new TaskRepository(vault);
		const baseline = structuredClone(task);
		baseline.metadata.custom = { severity: 'high' };
		const oldProject = structuredClone(project);
		oldProject.customFields = [{ id: 'severity-id', key: 'severity', name: 'Severity', type: 'text', required: false, active: true, default: null }];
		await repository.create('task.md', baseline);
		vault.files.set('task.md', (await vault.read('task.md')).replace('severity: high', 'severity: high\nexternal: keep'));
		const edited = structuredClone(baseline);
		delete edited.metadata.custom.severity;
		edited.metadata.custom.priority = 'high';
		const newProject = structuredClone(project);
		newProject.customFields = [{ ...oldProject.customFields[0]!, key: 'priority' }];

		await repository.save('task.md', edited, newProject, baseline);

		const saved = await repository.read('task.md', newProject);
		expect(saved.document?.metadata.custom).toEqual({ priority: 'high' });
		expect(saved.document?.unknownFrontmatter).toEqual({ external: 'keep' });
		expect(await vault.read('task.md')).not.toContain('severity:');
	});
});
