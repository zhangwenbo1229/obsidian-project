import { describe, expect, it } from 'vitest';
import {
	parseTaskMarkdown,
	serializeTaskMarkdown,
} from '../../src/markdown/task-parser';

const source = `---
pm-kind: task
pm-schema: 1
uid: 550e8400-e29b-41d4-a716-446655440000
key: PROJ-123
project-uid: 778de407-26bf-45ee-b22e-cf1f0bc826ce
title: 修复登录失败问题
task-type-id: bug
task-priority: high
created-at: 2026-07-12T14:30:00+08:00
start-date: 2026-07-13
due-date: 2026-07-20
completed-at: null
terminated-at: null
reporter-id: 8a67a66f-0109-47b3-9463-5d05b4295949
assignee-id: null
status-id: doing
tags:
  - 登录
severity: critical
external-property: keep-me
---

## 任务正文

移动端输入正确密码后仍停留在登录页。

## 链接

- 父任务：[[PROJ-100|完善认证流程]] <!-- op-relation-id: c2443c20-f09b-41e9-84fd-0eb4a3cd233d; target-uid: 104430ee-91c8-4aec-8182-755cce14e0b6 -->
- [[普通笔记]]

## 子任务

- [ ] 完成移动端回归
- [x] 补充登录日志

## 备注

### 2026-07-12 15:10 · 张三

<!-- op-note-id: 1c357dce-9e98-47ed-85cc-c589ab4c068d; author-id: 8a67a66f-0109-47b3-9463-5d05b4295949 -->

已确认问题只在移动端出现。
`;

const parse = (markdown: string) =>
	parseTaskMarkdown(markdown, { customFieldKeys: new Set(['severity']) });

describe('task markdown parser', () => {
	it('parses metadata, reserved sections, relations, notes, and unknown content', () => {
		const result = parse(source);

		expect(result.issues).toEqual([]);
			expect(result.document?.metadata).toMatchObject({
			uid: '550e8400-e29b-41d4-a716-446655440000',
			key: 'PROJ-123',
				title: '修复登录失败问题',
				priority: 'high',
				custom: { severity: 'critical' },
		});
		expect(result.document?.unknownFrontmatter).toEqual({
			'external-property': 'keep-me',
		});
		expect(result.document?.body).toBe(
			'移动端输入正确密码后仍停留在登录页。',
		);
		expect(result.document?.relations).toEqual([
			expect.objectContaining({
				type: 'parent',
				targetKey: 'PROJ-100',
				targetUid: '104430ee-91c8-4aec-8182-755cce14e0b6',
			}),
		]);
		expect(result.document?.unknownLinks).toEqual(['- [[普通笔记]]']);
		expect(result.document?.subtasks).toBe('- [ ] 完成移动端回归\n- [x] 补充登录日志');
		expect(result.document?.notes).toEqual([
			expect.objectContaining({
				id: '1c357dce-9e98-47ed-85cc-c589ab4c068d',
				authorName: '张三',
				content: '已确认问题只在移动端出现。',
			}),
		]);
	});

	it('defaults legacy tasks without priority to medium', () => {
		const result = parse(source.replace('task-priority: high\n', ''));
		expect(result.document?.metadata.priority).toBe('medium');
	});

	it('migrates the legacy due date to the plan date when four-date keys are absent', () => {
		const result = parse(source);
		expect(result.document?.metadata).toMatchObject({
			scheduledDate: '2026-07-20',
			dueDate: null,
			startDate: '2026-07-13',
			endDate: null,
		});
	});

	it('round-trips the explicit four-date project model', () => {
		const modern = source
			.replace('start-date: 2026-07-13\ndue-date: 2026-07-20', [
				'scheduled-date: 2026-07-16T09:00:00+08:00',
				'due-date: 2026-07-20T18:00:00+08:00',
				'start-date: 2026-07-15T10:00:00+08:00',
				'end-date: 2026-07-22T17:00:00+08:00',
			].join('\n'));
		const parsed = parse(modern);
		expect(parsed.document?.metadata).toMatchObject({
			scheduledDate: '2026-07-16T09:00:00+08:00', dueDate: '2026-07-20T18:00:00+08:00',
			startDate: '2026-07-15T10:00:00+08:00', endDate: '2026-07-22T17:00:00+08:00',
		});
		const serialized = serializeTaskMarkdown(parsed.document!);
		expect(serialized).toContain('scheduled-date: 2026-07-16T09:00:00+08:00');
		expect(serialized).toContain('due-date: 2026-07-20T18:00:00+08:00');
		expect(serialized).toContain('start-date: 2026-07-15T10:00:00+08:00');
		expect(serialized).toContain('end-date: 2026-07-22T17:00:00+08:00');
	});

	it('derives built-in priority from an existing legacy priority custom value', () => {
		const legacy = source.replace('task-priority: high', 'priority: low');
		const result = parseTaskMarkdown(legacy, { customFieldKeys: new Set(['severity', 'priority']) });
		expect(result.document?.metadata.priority).toBe('low');
		expect(result.document?.metadata.custom.priority).toBe('low');
	});

	it('round-trips unknown frontmatter and ordinary links', () => {
		const parsed = parse(source);
		const serialized = serializeTaskMarkdown(parsed.document!);
		const reparsed = parse(serialized);

		expect(reparsed.issues).toEqual([]);
		expect(reparsed.document?.unknownFrontmatter).toEqual({
			'external-property': 'keep-me',
		});
		expect(reparsed.document?.unknownLinks).toEqual(['- [[普通笔记]]']);
		expect(reparsed.document?.subtasks).toBe('- [ ] 完成移动端回归\n- [x] 补充登录日志');
		expect(reparsed.document?.notes[0]?.content).toBe(
			'已确认问题只在移动端出现。',
		);
	});

	it('writes project/task headings while continuing to read legacy headings', () => {
		const legacy = parse(source).document!;
		const serialized = serializeTaskMarkdown(legacy);
		expect(serialized).toContain('## 项目描述');
		expect(serialized).toContain('## 任务');
		expect(serialized).not.toContain('## 任务正文');
		expect(serialized).not.toContain('## 子任务');
		const reparsed = parse(serialized);
		expect(reparsed.document?.body).toBe(legacy.body);
		expect(reparsed.document?.subtasks).toBe(legacy.subtasks);
	});

	it('keeps legacy tasks without a subtask section valid', () => {
		const legacy = source.replace(/\n## 子任务\n[\s\S]*?(?=\n## 备注)/u, '');
		const result = parse(legacy);
		expect(result.issues).toEqual([]);
		expect(result.document?.subtasks).toBe('');
	});

	it('preserves CRLF when serializing a parsed document', () => {
		const parsed = parse(source.replaceAll('\n', '\r\n'));

		const serialized = serializeTaskMarkdown(parsed.document!);

		expect(serialized).toContain('\r\n## 项目描述\r\n');
		expect(serialized.replaceAll('\r\n', '')).not.toContain('\n');
	});

	it('reports missing reserved sections without discarding existing body', () => {
		const malformed = source.replace('## 链接', '## 其他链接');

		const result = parse(malformed);

		expect(result.document).not.toBeNull();
		expect(result.issues).toContainEqual(
			expect.objectContaining({ code: 'missing-section', path: '链接' }),
		);
	});
});
