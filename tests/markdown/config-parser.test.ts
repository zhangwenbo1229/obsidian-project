import { describe, expect, it } from 'vitest';
import {
	parseGlobalConfigMarkdown,
	parseProjectConfigMarkdown,
	serializeProjectConfigMarkdown,
} from '../../src/markdown/config-parser';

describe('config markdown parser', () => {
	it('parses the shared people configuration', () => {
		const result = parseGlobalConfigMarkdown(`---
pm-kind: global-config
pm-schema: 1
project-config-directory: 项目管理/项目配置
default-task-directory: 项目管理/任务
current-user-id: 8a67a66f-0109-47b3-9463-5d05b4295949
people:
  - id: 8a67a66f-0109-47b3-9463-5d05b4295949
    name: 张三
    active: true
---
`);

		expect(result.issues).toEqual([]);
		expect(result.config).toMatchObject({
			projectConfigDirectory: '项目管理/项目配置',
			currentUserId: '8a67a66f-0109-47b3-9463-5d05b4295949',
		});
	});

	it('round-trips a project workflow and task template', () => {
		const markdown = `---
pm-kind: project
pm-schema: 1
project-uid: 778de407-26bf-45ee-b22e-cf1f0bc826ce
code: PROJ
name: 示例项目
active: true
task-directory: 项目管理/任务/PROJ
group-by-month: true
next-number: 2
task-types:
  - id: bug
    name: 缺陷
    icon: bug
    color: "#ef4444"
    active: true
    template: |-
      ### 复现步骤

      ### 实际结果
custom-fields: []
workflow:
  initial-status-id: waiting
  statuses:
    - id: waiting
      name: 待处理
      category: todo
      result: null
      active: true
    - id: completed
      name: 已完成
      category: done
      result: completed
      active: true
  transitions:
    - id: finish
      name: 完成
      from: waiting
      to: completed
---
`;

		const parsed = parseProjectConfigMarkdown(markdown);
		const serialized = serializeProjectConfigMarkdown(parsed.config!);
		const reparsed = parseProjectConfigMarkdown(serialized);

		expect(parsed.issues).toEqual([]);
		expect(reparsed.issues).toEqual([]);
		expect(reparsed.config?.taskTypes[0]?.template).toBe(
			'### 复现步骤\n\n### 实际结果',
		);
		expect(reparsed.config?.workflow.transitions[0]).toMatchObject({
			from: 'waiting',
			to: 'completed',
		});
	});
});
