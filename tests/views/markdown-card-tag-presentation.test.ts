import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const cardFields = readFileSync(new URL('../../src/views/task-card-fields.ts', import.meta.url), 'utf8');
const project = readFileSync(new URL('../../src/views/project-view.ts', import.meta.url), 'utf8');
const projectList = readFileSync(new URL('../../src/views/project-list-renderer.ts', import.meta.url), 'utf8');
const personal = readFileSync(new URL('../../src/views/personal-view.ts', import.meta.url), 'utf8');
const integration = readFileSync(new URL('../../src/integrations/builtin-tag-editor.ts', import.meta.url), 'utf8');
const markerPicker = readFileSync(new URL('../../src/modals/task-marker-picker-modal.ts', import.meta.url), 'utf8');
const cardInteraction = readFileSync(new URL('../../src/views/task-card-interaction.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

describe('Markdown task fields and shared card presentation', () => {
	it('renders links and subtasks as Markdown through the owning view component', () => {
		expect(cardFields).toContain('MarkdownRenderer');
		expect(cardFields).toContain('component: Component');
		expect(cardFields).toMatch(/MarkdownRenderer\.render\([\s\S]*task\.path[\s\S]*options\.component/u);
		expect(project).toContain('renderProjectList');
		expect(projectList).toContain('renderTaskListField');
		expect(cardFields).toContain('renderTaskMarkdownValue');
	});

	it('uses accessible non-button cards so rendered links and checkboxes remain valid', () => {
		for (const source of [project, personal]) {
			expect(source).toContain("role: 'button'");
			expect(source).toContain("tabindex: '0'");
			expect(source).toContain('bindTaskCardActivation');
		}
		expect(cardInteraction).toContain('isInteractiveTaskCardTarget');
		expect(project).not.toMatch(/createEl\('button',\s*\{\s*cls:\s*'op-(?:board-card|calendar-task|quadrant-card)'/u);
		expect(personal).not.toMatch(/createEl\('button',\s*\{\s*cls:\s*'op-task-card'/u);
	});

	it('defaults to all projects and unifies card marker and priority placement', () => {
		expect(project).toContain('private projectUid = ALL_PROJECTS_UID');
		expect(project).toContain('markerBeforeKey: true');
		expect(project).toContain('priorityInCorner: true');
		expect(cardFields).toContain('op-task-card-priority');
		expect(css).toMatch(/\.op-task-card-priority\s*\{[^}]*position:\s*absolute[^}]*top:/u);
	});

	it('gives calendar cards enough vertical room for configured fields', () => {
		expect(css).toMatch(/\.op-calendar-task\s*\{[^}]*min-height:\s*(?:4[4-9]|[5-9]\d)px/u);
	});
});

describe('marker and tag style presentation', () => {
	it('offers a broad catalog of common Lucide icons and emoji', () => {
		const values = [...markerPicker.matchAll(/value:\s*'([^']+)'/gu)].map((match) => match[1]);
		expect(values.length).toBeGreaterThanOrEqual(60);
		for (const expected of ['clipboard-list', 'database', 'code-2', 'users', '🔧', '📌', '🧪', '🎨']) {
			expect(values).toContain(expected);
		}
	});

	it('shares configured icon/color tag rendering and removes the hash prefix', () => {
		const helperUrl = new URL('../../src/views/tag-presentation.ts', import.meta.url);
		expect(existsSync(helperUrl)).toBe(true);
		if (existsSync(helperUrl)) {
			const helper = readFileSync(helperUrl, 'utf8');
			expect(helper).toContain('manager.tagStyles');
			expect(helper).toContain('renderTag');
			expect(helper).toContain('setIcon');
			expect(helper).not.toContain('`#${tag}`');
		}
		expect(cardFields).toContain('renderTags');
		expect(projectList).toContain('renderTaskListField');
	});

	it('adds a right-click style editor to the built-in Tags pane', () => {
		expect(integration).toContain("'contextmenu'");
		expect(integration).toContain('编辑标签样式');
		expect(integration).toContain('TagStyleModal');
		expect(integration).toContain('MutationObserver');
	});

	it('reads the current Tags pane label without including the count or replacing native text', () => {
		expect(integration).toContain('findBuiltinTagText');
		expect(integration).toContain('tag-pane-tag-parent');
		expect(integration).toContain('moveTagStyle');
		expect(integration).not.toContain("const TAG_TEXT_SELECTOR = '.tag-pane-tag-text'");
		expect(integration).not.toContain('text.setText(path)');
		expect(integration).toContain("querySelector<HTMLElement>('.tree-item-inner')");
		expect(integration).toContain('setTimeout(applyTagStyles, 0)');
		expect(integration).not.toContain('requestAnimationFrame(applyTagStyles)');
	});

	it('keeps native tag icons and names on one line and renders group actions', () => {
		expect(integration).toContain('op-tag-group-heading');
		expect(integration).toContain('新建标签分组');
		expect(integration).toContain('设置标签分组');
		expect(integration).toContain('TagGroupModal');
		expect(integration).toContain('TagGroupAssignmentModal');
		expect(css).toMatch(/\.tag-pane-tag \.tree-item-inner\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center/u);
		expect(css).toContain('.op-tag-group-heading');
	});

	it('renders task relations as interactive links in cards and project lists', () => {
		const helperUrl = new URL('../../src/views/task-relation-presentation.ts', import.meta.url);
		expect(existsSync(helperUrl)).toBe(true);
		if (!existsSync(helperUrl)) return;
		const relationPresentation = readFileSync(helperUrl, 'utf8');
		expect(relationPresentation).toContain('renderTaskRelations');
		expect(relationPresentation).toContain('manager.openTask');
		expect(relationPresentation).toContain('op-task-relation-link');
		expect(relationPresentation).toContain("createEl('a'");
		expect(relationPresentation).not.toContain("createEl('button'");
		expect(cardFields).toContain('renderTaskRelations');
		expect(projectList).toContain('renderTaskListField');
	});

	it('aligns link field labels with rendered Markdown content', () => {
		expect(css).toMatch(/\.op-card-field\.is-links\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/u);
		expect(css).toMatch(/\.op-card-field\.is-links \.op-card-markdown li p\s*\{[^}]*margin:\s*0/u);
	});
});
