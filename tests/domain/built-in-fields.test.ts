import { describe, expect, it } from 'vitest';
import { BUILT_IN_FIELD_DEFINITIONS, builtInFieldId, ensureBuiltInFields } from '../../src/domain/built-in-fields';
import type { UnifiedMetadataField } from '../../src/domain/metadata-types';

function makeBuiltIn(key: string, name: string): UnifiedMetadataField {
	return {
		id: builtInFieldId(key),
		key,
		name,
		type: 'text',
		icon: 'brackets',
		color: '#626f86',
		required: false,
		defaultValue: null,
		isBuiltIn: true,
		builtInKey: key,
	};
}

function makeCustom(key: string, name: string): UnifiedMetadataField {
	return {
		id: `custom-${key}`,
		key,
		name,
		type: 'text',
		icon: 'brackets',
		color: '#626f86',
		required: false,
		defaultValue: null,
	};
}

describe('ensureBuiltInFields', () => {
	it('adds missing built-in fields', () => {
		const existing: UnifiedMetadataField[] = [];
		const result = ensureBuiltInFields(existing);
		expect(result.length).toBeGreaterThanOrEqual(BUILT_IN_FIELD_DEFINITIONS.length);
		for (const def of BUILT_IN_FIELD_DEFINITIONS) {
			expect(result.some((f) => f.builtInKey === def.key)).toBe(true);
		}
	});

	it('removes deprecated built-in fields whose builtInKey is no longer in BUILT_IN_FIELD_DEFINITIONS', () => {
		const existing: UnifiedMetadataField[] = [
			makeBuiltIn('title', '标题'),
			makeBuiltIn('body', '项目描述'),
			makeBuiltIn('notes', '备注'),
			makeBuiltIn('doneDate', '完成日期'),
			makeBuiltIn('subtasks', '子任务'),
			makeCustom('email', 'Email'),
		];
		const result = ensureBuiltInFields(existing);

		// 保留在定义中的内置字段
		expect(result.some((f) => f.builtInKey === 'title')).toBe(true);

		// 不在定义中的废弃内置字段
		expect(result.some((f) => f.builtInKey === 'body')).toBe(false);
		expect(result.some((f) => f.builtInKey === 'notes')).toBe(false);
		expect(result.some((f) => f.builtInKey === 'doneDate')).toBe(false);
		expect(result.some((f) => f.builtInKey === 'subtasks')).toBe(false);

		// 自定义字段保留
		expect(result.some((f) => f.key === 'email')).toBe(true);

		// 新增的 task 字段（renamed from subtasks）
		expect(result.some((f) => f.builtInKey === 'task')).toBe(true);
	});

	it('preserves custom fields (isBuiltIn: false) regardless of key', () => {
		const existing: UnifiedMetadataField[] = [
			makeCustom('email', 'Email'),
			makeCustom('phone', 'Phone'),
			makeCustom('body', 'Custom Body'), // 即使 key 与废弃内置字段同名
		];
		const result = ensureBuiltInFields(existing);
		expect(result.some((f) => f.key === 'email')).toBe(true);
		expect(result.some((f) => f.key === 'phone')).toBe(true);
		expect(result.some((f) => f.key === 'body')).toBe(true);
	});

	it('preserves all valid built-in fields currently in BUILT_IN_FIELD_DEFINITIONS', () => {
		const existing: UnifiedMetadataField[] = [];
		const result = ensureBuiltInFields(existing);
		const currentKeys = new Set(BUILT_IN_FIELD_DEFINITIONS.map((def) => def.key));
		for (const field of result) {
			if (field.isBuiltIn) {
				const key = field.builtInKey ?? field.key;
				expect(currentKeys.has(key)).toBe(true);
			}
		}
	});

	it('does not duplicate built-in fields', () => {
		const existing: UnifiedMetadataField[] = [
			makeBuiltIn('title', '标题'),
			makeBuiltIn('priority', '优先级'),
		];
		const result = ensureBuiltInFields(existing);
		const titleFields = result.filter((f) => f.builtInKey === 'title');
		expect(titleFields.length).toBe(1);
		const priorityFields = result.filter((f) => f.builtInKey === 'priority');
		expect(priorityFields.length).toBe(1);
	});
});