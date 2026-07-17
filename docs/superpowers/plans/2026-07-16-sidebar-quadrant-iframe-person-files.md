# Sidebar, Quadrant Drag, Iframe Cards, and Person Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore configured property groups, add vertical quadrant priority drag, introduce secure iframe dashboard cards, refine project dialogs, and make person creation persist linkable Markdown files.

**Architecture:** Keep sidebar grouping and quadrant priority decisions in pure helpers so DOM integrations only render and dispatch. Register iframe as a normal dashboard module with URL normalization and a sandboxed renderer. Treat a person Markdown file as the durable vault representation while retaining the plugin configuration record for fast lookup; `person-id` connects both representations and `sourcePath` makes mentions navigable.

**Tech Stack:** TypeScript, Obsidian API, YAML frontmatter, esbuild, Vitest/happy-dom, CSS.

---

### Task 1: Property groups remain visible

**Files:**
- Modify: `src/integrations/builtin-property-editor.ts`
- Test: `tests/views/property-management-view.test.ts`

- [ ] **Step 1: Write a failing empty-group test**

```ts
expect(propertyGroupEntries([{ row, key: 'status' }], settings).map((group) => group.name))
	.toEqual(['工作', '未分组']);
```

- [ ] **Step 2: Run `npx vitest run tests/views/property-management-view.test.ts` and verify the configured empty group is missing.**

- [ ] **Step 3: Preserve configured groups and only omit an empty implicit group**

```ts
return groups.map((group) => ({ ...group, members: rows.filter(...) }))
	.filter((group) => group.id || group.members.length > 0);
```

- [ ] **Step 4: Run the focused test and verify it passes.**

### Task 2: Vertical quadrant priority drag

**Files:**
- Create: `src/views/quadrant-priority.ts`
- Modify: `src/views/project-view.ts`
- Modify: `styles.css`
- Create: `tests/views/quadrant-priority.test.ts`
- Modify: `tests/views/project-view-regressions.test.ts`

- [ ] **Step 1: Write failing priority selection tests**

```ts
expect(priorityForQuadrantDrop('high', 'notImportantUrgent', ['high'])).toBe('medium');
expect(priorityForQuadrantDrop('low', 'importantNotUrgent', ['high', 'medium'])).toBe('high');
```

- [ ] **Step 2: Run both focused tests and verify the helper and drag bindings are missing.**

- [ ] **Step 3: Implement deterministic vertical priority mapping**

```ts
export function priorityForQuadrantDrop(current, quadrant, important) {
	const targetImportant = quadrant.startsWith('important');
	const ordered = ['high', 'medium', 'low'] as const;
	const candidates = ordered.filter((priority) => important.includes(priority) === targetImportant);
	return candidates.includes(current) ? current : candidates[0] ?? current;
}
```

- [ ] **Step 4: Make quadrant regions drop targets and cards draggable; clone the task document, update `metadata.priority`, save it, and suppress card activation after a drag.**

- [ ] **Step 5: Run the focused tests and verify they pass.**

### Task 3: Sandboxed iframe dashboard card

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/views/dashboard-modules/config.ts`
- Create: `src/views/dashboard-modules/iframe-card.ts`
- Modify: `src/views/dashboard-modules/module-settings.ts`
- Modify: `src/views/dashboard-modules/registry.ts`
- Modify: `src/views/personal-dashboard-settings.ts`
- Modify: `src/settings/personal-dashboard-settings-editor.ts`
- Modify: `styles.css`
- Modify: `tests/views/dashboard-module-config.test.ts`
- Modify: `tests/views/dashboard-module-registry.test.ts`
- Modify: `tests/views/dashboard-module-presentation.test.ts`

- [ ] **Step 1: Write failing catalog, URL normalization, renderer, and settings tests.**

```ts
expect(normalizeDashboardModuleConfig('iframe', { url: 'javascript:alert(1)' })).toEqual({ url: '' });
expect(normalizeDashboardModuleConfig('iframe', { url: 'https://example.com/widget' })).toEqual({ url: 'https://example.com/widget' });
```

- [ ] **Step 2: Run the three focused tests and verify `iframe` is unsupported.**

- [ ] **Step 3: Add `IframeDashboardModuleConfig`, catalog metadata, settings URL input, and a renderer that creates:**

```ts
const frame = body.createEl('iframe', { cls: 'op-iframe-card-frame', attr: {
	src: config.url, sandbox: 'allow-forms allow-popups allow-scripts allow-same-origin',
	referrerpolicy: 'no-referrer', loading: 'lazy', title: context.card.title ?? '网页卡片',
} });
```

- [ ] **Step 4: Run the focused tests and verify they pass.**

### Task 4: Project dialog density and tag suggestions

**Files:**
- Modify: `src/modals/create-task-modal.ts`
- Modify: `src/modals/edit-task-modal.ts`
- Modify: `src/modals/grouped-tag-picker.ts`
- Modify: `styles.css`
- Modify: `tests/views/task-dialog-layout.test.ts`
- Modify: `tests/modals/tag-picker-model.test.ts`

- [ ] **Step 1: Write failing assertions for a wide four-column custom-field section, radio groups, input-gated suggestions, and closing after opening Markdown.**

- [ ] **Step 2: Run focused tests and verify current two-column and always-visible behavior fails.**

- [ ] **Step 3: Make custom fields use `op-task-dialog-section-wide`, four desktop columns with two-column and one-column responsive fallbacks; keep native radio inputs and hide the suggestion panel unless `input.value.trim()` is non-empty.**

- [ ] **Step 4: Change the edit action to:**

```ts
button.onClick(() => { this.close(); void this.manager.openTask(this.entry.path); });
```

- [ ] **Step 5: Run focused tests and verify they pass.**

### Task 5: Person Markdown persistence and mentions

**Files:**
- Create: `src/markdown/person-parser.ts`
- Modify: `src/services/people-source.ts`
- Modify: `src/services/project-manager.ts`
- Modify: `src/modals/person-modal.ts`
- Modify: `src/integrations/markdown-reference-renderer.ts`
- Modify: `src/main.ts`
- Modify: `tests/services/people-source.test.ts`
- Create: `tests/markdown/person-parser.test.ts`
- Modify: `tests/views/markdown-reference-renderer.test.ts`

- [ ] **Step 1: Write failing serialization, stable-id import, and clickable mention tests.**

```ts
expect(parseFrontmatter(serializePersonMarkdown(person, settings, fields)).frontmatter['person-id']).toBe(person.id);
expect(root.querySelector('.op-person-reference')?.getAttribute('data-href')).toBe('人员/Alice.md');
```

- [ ] **Step 2: Run focused tests and verify files and links are absent.**

- [ ] **Step 3: Serialize `pm-kind: person`, `pm-schema: 1`, `person-id`, configured name property, active state, and typed metadata. Create new files under the configured folder or `项目管理/人员`, update existing files without discarding the Markdown body, and set `sourcePath` before persisting configuration.**

- [ ] **Step 4: Import `person-id` when present, expose `sourcePath` to the postprocessor, and render mentions as `a.internal-link.op-person-reference` with `data-href`, `href`, icon, color, and title.**

- [ ] **Step 5: Run focused tests and verify they pass.**

### Task 6: Full verification and deployment

**Files:**
- Modify only files required by failures.

- [ ] **Step 1: Run `npm run lint`, `npm test`, `npx tsc --noEmit --skipLibCheck`, and `git diff --check`; expect no errors.**

- [ ] **Step 2: Run `$env:OBSIDIAN_VAULT_PATH='D:\code\obsidian\test'; npm run build`; expect deployment to the test Vault plugin directory.**

- [ ] **Step 3: Restart Obsidian if the old CLI keeps a stale plugin instance, then inspect `dev:errors`, `dev:console level=error`, property headings, iframe DOM, quadrant drag behavior, project dialog DOM, created person file, and rendered mention.**
