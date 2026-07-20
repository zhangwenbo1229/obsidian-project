import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const taskFormFieldsSource = readFileSync(new URL('../../src/modals/task-form-fields.ts', import.meta.url), 'utf8');
const personModalSource = readFileSync(new URL('../../src/modals/person-modal.ts', import.meta.url), 'utf8');
const groupedTagPickerSource = readFileSync(new URL('../../src/modals/grouped-tag-picker.ts', import.meta.url), 'utf8');

describe('tag metadata grouped picker', () => {
	describe('task-form-fields multi-select', () => {
		it('uses renderGroupedTagPicker for multi-select custom fields', () => {
			expect(taskFormFieldsSource).toMatch(/multi-select.*renderGroupedTagPicker/su);
		});

		it('passes setting.controlEl as container to renderGroupedTagPicker', () => {
			expect(taskFormFieldsSource).toMatch(/setting\.controlEl/u);
		});
	});

	describe('person-modal multi-select', () => {
		it('imports renderGroupedTagPicker', () => {
			expect(personModalSource).toMatch(/renderGroupedTagPicker/u);
		});

		it('uses renderGroupedTagPicker for multi-select metadata fields', () => {
			expect(personModalSource).toMatch(/multi-select.*renderGroupedTagPicker/su);
		});
	});

	describe('grouped-tag-picker component', () => {
		it('a group-select dropdown', () => {
			expect(groupedTagPickerSource).toMatch(/group-select/u);
		});

		it('tagged groups rendering', () => {
			expect(groupedTagPickerSource).toMatch(/availableTagGroups/u);
		});
	});
});