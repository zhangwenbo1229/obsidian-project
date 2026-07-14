let response;
try {
	response = await fetch('http://127.0.0.1:9222/json');
} catch {
	const { execFile } = await import('node:child_process');
	const expression = `(${seedDemoProject.toString()})()`;
	const output = await new Promise((resolve, reject) => {
		execFile(
			'obsidian',
			['vault=test', 'eval', `code=${expression}`],
			{ maxBuffer: 4 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error) reject(new Error(stderr || error.message));
				else resolve(stdout);
			},
		);
	});
	process.stdout.write(output);
	process.exit(/\bError:/u.test(output) ? 1 : 0);
}
const targets = await response.json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('找不到正在运行的 Obsidian 页面。');
if (typeof WebSocket === 'undefined') throw new Error('当前 Node.js 版本不支持 WebSocket，请使用 Node.js 22 或更高版本。');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	socket.onopen = resolve;
	socket.onerror = reject;
});

let requestId = 0;
const pending = new Map();
const runtimeErrors = [];
socket.onmessage = (event) => {
	const message = JSON.parse(event.data);
	if (message.id && pending.has(message.id)) {
		const request = pending.get(message.id);
		pending.delete(message.id);
		if (message.error) request.reject(message.error);
		else request.resolve(message.result);
	}
	if (message.method === 'Runtime.exceptionThrown') {
		runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
	}
};

function send(method, params = {}) {
	return new Promise((resolve, reject) => {
		const id = ++requestId;
		pending.set(id, { resolve, reject });
		socket.send(JSON.stringify({ id, method, params }));
	});
}

async function seedDemoProject() {
	const plugin = app.plugins.getPlugin('obsidian-project');
	if (!plugin?._loaded) throw new Error('obsidian-project 尚未启用。');
	const manager = plugin.manager;
	manager.taskTemplates ??= [];
	manager.savedProjectFilters ??= [];
	for (const issue of manager.dataIssues.filter((item) =>
		item.issue.code === 'orphan-task' && item.path.startsWith('项目管理/任务/DEMO/'),
	)) {
		const file = app.vault.getFileByPath(issue.path);
		if (file) await app.fileManager.trashFile(file);
	}
	await manager.reload();
	const people = [
		{ id: '11111111-1111-4111-8111-111111111111', name: '产品负责人' },
		{ id: '22222222-2222-4222-8222-222222222222', name: '开发同学' },
	];
	let peopleChanged = false;
	for (const person of people) {
		if (manager.globalConfig.people.some((item) => item.id === person.id)) continue;
		manager.globalConfig.people.push({ ...person, active: true });
		peopleChanged = true;
	}
	if (peopleChanged) await manager.saveGlobalConfig();

	const existingDemoTasks = manager.index.validTasks().filter((task) =>
		task.project.code === 'PLAY' && task.document.metadata.tags.includes('demo-data'),
	);
	const demoUids = new Set(existingDemoTasks.map((task) => task.document.metadata.uid));
	for (const entry of manager.index.validTasks()) {
		const document = structuredClone(entry.document);
		const relations = document.relations.filter((relation) => !demoUids.has(relation.targetUid));
		if (relations.length === document.relations.length) continue;
		document.relations = relations;
		await manager.saveTask(entry, document);
	}
	for (const demo of existingDemoTasks) {
		const current = manager.index.get(demo.document.metadata.uid);
		if (current) await manager.deleteTask(current);
	}

	const demoTemplate = {
		id: 'demo-delivery-template',
		name: '敏捷交付模板',
		description: '适用于产品需求、研发任务和缺陷跟踪的演示模板。',
		taskTypes: [
			{ id: 'task', name: '任务', icon: 'circle-check', color: '#0c66e4', marker: 'circle-check', titleColor: '#0c66e4', active: true, template: '## 执行计划\n\n- [ ] 拆分步骤\n- [ ] 完成交付\n\n## 验收标准\n\n描述可验证的完成条件。' },
			{ id: 'bug', name: '缺陷', icon: 'bug', color: '#c9372c', marker: '🐞', titleColor: '#c9372c', active: true, template: '## 复现步骤\n\n1. \n\n## 期望结果\n\n\n## 实际结果\n\n' },
			{ id: 'requirement', name: '需求', icon: 'lightbulb', color: '#b65c02', marker: '💡', titleColor: '#b65c02', active: true, template: '## 用户价值\n\n\n## 需求说明\n\n\n## 验收条件\n\n- [ ] ' },
		],
		customFields: [
			{ id: 'points-field', key: 'story-points', name: '故事点', type: 'number', required: false, active: true, default: null },
			{ id: 'risk-field', key: 'high-risk', name: '高风险', type: 'boolean', required: false, active: true, default: false },
			{ id: 'release-field', key: 'target-release', name: '目标版本', type: 'text', required: false, active: true, default: '1.1.0' },
			{ id: 'review-field', key: 'review-at', name: '评审时间', type: 'datetime', required: false, active: true, default: null },
		],
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
			],
		},
	};
	const demoTemplates = demoTemplate.taskTypes.map((taskType) => ({
		...structuredClone(demoTemplate),
		id: `demo-${taskType.id}-template`,
		name: taskType.name,
		taskTypes: [structuredClone(taskType)],
	}));
	manager.taskTemplates = manager.taskTemplates.filter((template) => !template.id.startsWith('demo-'));
	for (const template of demoTemplates) await manager.saveTaskTemplate(template);

	if (!manager.projects.some((project) => project.code === 'PLAY')) {
		await manager.createProject('PLAY', '功能演示项目');
	}
	let project = manager.projects.find((item) => item.code === 'PLAY');
	project.name = '功能演示项目';
	await manager.applyTemplatesToProject(project, demoTemplates.map((template) => template.id));
	project = manager.projects.find((item) => item.code === 'PLAY');

	manager.savedProjectFilters = manager.savedProjectFilters.filter((filter) => filter.projectUid !== project.uid || !filter.name.startsWith('演示 ·'));
	for (const filter of [
		{
			id: '33333333-3333-4333-8333-333333333331', name: '演示 · 本周处理中', projectUid: project.uid,
			filters: { projectUid: project.uid, statusCategories: ['in_progress'], dueDateFrom: '2026-07-13', dueDateTo: '2026-07-19' },
		},
		{
			id: '33333333-3333-4333-8333-333333333332', name: '演示 · 高风险缺陷', projectUid: project.uid,
			filters: { projectUid: project.uid, taskTypeIds: ['bug'], customFields: { 'high-risk': [true] } },
		},
	]) {
		await manager.saveProjectFilter({ ...filter, createdAt: '2026-07-13T09:00:00+08:00', updatedAt: '2026-07-13T09:00:00+08:00' });
	}

	const definitions = [
		['搭建项目管理首页', 'requirement', 'doing', '2026-07-08', '2026-07-15', people[0].id, ['frontend', 'milestone'], { priority: 'high', 'story-points': 8, 'high-risk': false, 'target-release': '1.1.0', 'review-at': '2026-07-14T10:00:00+08:00' }],
		['修复移动端登录阻塞', 'bug', 'waiting', null, '2026-07-10', people[1].id, ['mobile', 'urgent'], { priority: 'high', 'story-points': 5, 'high-risk': true, 'target-release': '1.0.1', 'review-at': '2026-07-12T16:00:00+08:00' }],
		['补充接口自动化测试', 'task', 'doing', '2026-07-11', '2026-07-13', people[1].id, ['backend', 'test'], { priority: 'medium', 'story-points': 3, 'high-risk': false, 'target-release': '1.1.0' }],
		['设计批量迁移恢复流程', 'requirement', 'completed', '2026-07-05', '2026-07-09', people[0].id, ['migration', 'architecture'], { priority: 'high', 'story-points': 8, 'high-risk': true, 'target-release': '1.0.0' }],
		['整理版本发布说明', 'task', 'waiting', null, null, null, ['docs'], { priority: 'low', 'story-points': 2, 'high-risk': false, 'target-release': '1.1.0' }],
		['看板拖拽状态偶发回弹', 'bug', 'cancelled', '2026-07-06', '2026-07-11', people[1].id, ['board', 'interaction'], { priority: 'medium', 'story-points': 3, 'high-risk': false, 'target-release': '1.0.0' }],
		['优化任务索引性能', 'task', 'completed', '2026-07-03', '2026-07-08', people[1].id, ['performance', 'index'], { priority: 'high', 'story-points': 5, 'high-risk': false, 'target-release': '1.0.0' }],
		['支持项目级自定义字段', 'requirement', 'doing', '2026-07-10', '2026-07-18', people[0].id, ['config', 'metadata'], { priority: 'medium', 'story-points': 8, 'high-risk': false, 'target-release': '1.1.0', 'review-at': '2026-07-16T14:30:00+08:00' }],
		['评审数据安全策略', 'task', 'waiting', null, '2026-07-20', people[0].id, ['security', 'review'], { priority: 'high', 'story-points': 3, 'high-risk': true, 'target-release': '1.1.0' }],
		['日历跨月显示异常', 'bug', 'waiting', null, '2026-07-05', people[1].id, ['calendar', 'urgent'], { priority: 'high', 'story-points': 2, 'high-risk': false, 'target-release': '1.0.1' }],
		['准备移动端回归清单', 'task', 'doing', '2026-07-12', '2026-07-14', people[1].id, ['mobile', 'qa'], { priority: 'medium', 'story-points': 3, 'high-risk': false, 'target-release': '1.0.1' }],
		['规划下一版本路线图', 'requirement', 'waiting', null, '2026-07-31', people[0].id, ['roadmap', 'planning'], { priority: 'low', 'story-points': 5, 'high-risk': false, 'target-release': '1.2.0', 'review-at': '2026-07-25T09:30:00+08:00' }],
	].map(([title, taskTypeId, statusId, startDate, dueDate, assigneeId, tags, custom]) => ({
		title, taskTypeId, statusId, startDate, dueDate, assigneeId, tags, custom,
	}));

	for (const definition of definitions) {
		const exists = manager.index.validTasks().some((task) =>
			task.project.code === 'PLAY' && task.document.metadata.title === definition.title,
		);
		if (exists) continue;
		project = manager.projects.find((item) => item.code === 'PLAY');
		await manager.createTask({
			project,
			title: definition.title,
			taskTypeId: definition.taskTypeId,
			assigneeId: definition.assigneeId,
			startDate: definition.startDate,
			dueDate: definition.dueDate,
			tags: [...definition.tags, 'demo-data'],
			custom: definition.custom,
			body: '',
			links: '- [[项目管理/演示说明]]\n- [Obsidian 插件文档](https://docs.obsidian.md/Plugins)',
			note: '由演示数据脚本创建，可在这里使用 **Markdown** 记录协作上下文。',
		});
	}

	for (const [index, definition] of definitions.entries()) {
		const entry = manager.index.validTasks().find((task) =>
			task.project.code === 'PLAY' && task.document.metadata.title === definition.title,
		);
		const document = structuredClone(entry.document);
		document.metadata.statusId = definition.statusId;
		document.metadata.startDate = definition.startDate;
		document.metadata.dueDate = definition.dueDate;
		document.metadata.completedAt = definition.statusId === 'completed' ? '2026-07-09T17:30:00+08:00' : null;
		document.metadata.terminatedAt = definition.statusId === 'cancelled' ? '2026-07-11T11:00:00+08:00' : null;
		document.body = `${definition.title}\n\n演示场景 ${index + 1}：覆盖类型、状态、筛选和日历展示。`;
		document.unknownLinks = [
			'- [[项目管理/演示说明]]',
			`- [场景 ${index + 1} 参考资料](https://example.com/demo/${index + 1})`,
		];
		if ([1, 3, 7].includes(index) && document.notes.length === 0) {
			document.notes.push({
				id: crypto.randomUUID(),
				authorId: manager.globalConfig.currentUserId,
				authorName: manager.globalConfig.people.find((person) => person.id === manager.globalConfig.currentUserId)?.name ?? '默认用户',
				createdAt: '2026-07-12T15:00:00+08:00',
				content: index === 1 ? '已确认问题只在移动端出现。' : '用于演示可编辑备注。',
			});
		}
		await manager.saveTask(entry, document);
	}

	const entries = definitions.map((definition) => manager.index.validTasks().find((task) =>
		task.project.code === 'PLAY' && task.document.metadata.title === definition.title,
	));
	const addRelation = async (sourceIndex, targetIndex, type) => {
		const entry = manager.index.get(entries[sourceIndex].document.metadata.uid);
		const target = entries[targetIndex];
		if (entry.document.relations.some((relation) => relation.type === type && relation.targetUid === target.document.metadata.uid)) return;
		const document = structuredClone(entry.document);
		document.relations.push({
			id: crypto.randomUUID(), type,
			targetUid: target.document.metadata.uid,
			targetKey: target.document.metadata.key,
			targetTitle: target.document.metadata.title,
		});
		await manager.saveTask(entry, document);
	};
	await addRelation(2, 0, 'parent');
	await addRelation(10, 0, 'parent');
	await addRelation(1, 9, 'related');

	const view = app.workspace.getLeavesOfType('obsidian-project-project')[0]?.view;
	if (view) {
		view.projectUid = manager.projects.find((item) => item.code === 'PLAY').uid;
		view.mode = 'board';
		view.render();
	}
	const tasks = manager.index.validTasks().filter((task) => task.project.code === 'PLAY');
	return {
		project: 'PLAY',
		count: tasks.length,
		statuses: Object.fromEntries(['waiting', 'doing', 'completed', 'cancelled'].map((status) => [status, tasks.filter((task) => task.document.metadata.statusId === status).length])),
		types: Object.fromEntries(['task', 'bug', 'requirement'].map((type) => [type, tasks.filter((task) => task.document.metadata.taskTypeId === type).length])),
		relations: tasks.reduce((count, task) => count + task.document.relations.length, 0),
		notes: tasks.reduce((count, task) => count + task.document.notes.length, 0),
		issues: manager.dataIssues,
	};
}

await send('Runtime.enable');
await new Promise((resolve) => setTimeout(resolve, 100));
runtimeErrors.length = 0;
const result = await send('Runtime.evaluate', {
	expression: `(${seedDemoProject.toString()})()`,
	awaitPromise: true,
	returnByValue: true,
	userGesture: true,
});
await new Promise((resolve) => setTimeout(resolve, 500));
console.log(JSON.stringify({
	value: result.result?.value,
	exception: result.exceptionDetails,
	runtimeErrors,
}, null, 2));
socket.close();
