import type { GlobalConfig, ProjectConfig } from '../domain/types';
import { createUuid } from '../utils/ids';
import { normalizePersonalDashboardSettings } from '../views/personal-dashboard-settings';
import { normalizeProjectViewDisplay } from '../views/task-display-settings';
import { ConfigurationSnapshot } from '../settings/configuration-store';

export function createDefaultConfiguration(): ConfigurationSnapshot {
	const userId = createUuid();
	return {
		globalConfig: {
			kind: 'global-config', schema: 1,
			projectConfigDirectory: 'plugin-data',
			defaultTaskDirectory: '项目管理/任务',
			currentUserId: userId,
			people: [{ id: userId, name: '默认用户', active: true }],
			personMetadataFields: [],
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

export function createDefaultProject(code: string, name: string, taskDirectory: string): ProjectConfig {
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