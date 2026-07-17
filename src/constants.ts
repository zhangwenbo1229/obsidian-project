export const PLUGIN_ID = 'obsidian-project';
export const TASK_SCHEMA_VERSION = 1;
export const CONFIG_SCHEMA_VERSION = 1;

export const BUILT_IN_TASK_TEMPLATES = {
	task: { name: '任务', body: '请描述执行步骤、交付结果和验收标准。' },
	bug: { name: '缺陷', body: '复现步骤：\n\n期望结果：\n\n实际结果：' },
	requirement: { name: '需求', body: '用户价值：\n\n需求说明：\n\n验收条件：' },
} as const;

export const RESERVED_TASK_HEADINGS = [
	'任务正文',
	'项目描述',
	'任务',
	'链接',
	'备注',
] as const;

export const RESERVED_TASK_KEYS = new Set([
	'pm-kind',
	'pm-schema',
	'uid',
	'key',
	'project-uid',
	'title',
	'task-type-id',
	'task-priority',
	'created-at',
	'scheduled-date',
	'start-date',
	'due-date',
	'end-date',
	'completed-at',
	'terminated-at',
	'reporter-id',
	'assignee-id',
	'status-id',
	'tags',
]);
