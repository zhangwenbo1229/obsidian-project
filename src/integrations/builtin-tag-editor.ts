import { Menu, Notice, Plugin, setIcon } from 'obsidian';
import type { ProjectManager } from '../services/project-manager';
import { reparentTagPath } from '../services/tag-service';
import { TagStyleModal } from '../modals/tag-style-modal';
import { TagGroupModal } from '../modals/tag-group-modal';
import { TagGroupAssignmentModal } from '../modals/tag-group-assignment-modal';
import { groupTags } from '../services/tag-group-service';

const TAG_ROW_SELECTOR = '.tag-pane-tag';
const TAG_CONTAINER_SELECTOR = '.tag-container, .tag-pane-tags';
const TAG_DRAG_TYPE = 'application/x-obsidian-project-tag';

function normalizeTagPath(value: string | null | undefined): string {
	return (value ?? '')
		.trim()
		.replace(/^(?:标签|tag)\s*[:：]\s*/iu, '')
		.replace(/^#+/u, '')
		.replace(/\s+\d+$/u, '')
		.trim();
}

function findBuiltinTagText(row: HTMLElement): HTMLElement | null {
	return row.querySelector<HTMLElement>('.tag-pane-tag-text')
		?? row.querySelector<HTMLElement>('.tree-item-inner-text .tree-item-inner-text')
		?? row.querySelector<HTMLElement>('.tree-item-inner > .tree-item-inner-text');
}

function extractTagPath(row: HTMLElement, text: HTMLElement): string {
	const parentPath = row.querySelector<HTMLElement>('.tag-pane-tag-parent')?.textContent ?? '';
	const visiblePath = normalizeTagPath(`${parentPath}${text.textContent ?? ''}`);
	if (visiblePath) return visiblePath;
	for (const value of [
		row.dataset.tag,
		text.dataset.tag,
		row.getAttribute('aria-label'),
		text.getAttribute('aria-label'),
	]) {
		const normalized = normalizeTagPath(value);
		if (normalized) return normalized;
	}
	return '';
}

export function registerBuiltinTagEditor(plugin: Plugin, manager: ProjectManager): void {
	const ownerDocument = plugin.app.workspace.containerEl.ownerDocument;
	let dropTarget: HTMLElement | null = null;
	let styleRefreshQueued = false;
	let styleRefreshTimer: number | undefined;
	const styleMigrations = new Set<string>();
	const elementFromEvent = (event: Event): HTMLElement | null => {
		const HTMLElementClass = ownerDocument.defaultView?.HTMLElement;
		return HTMLElementClass && event.target instanceof HTMLElementClass ? event.target : null;
	};
	const clearDragState = () => {
		ownerDocument.querySelectorAll('.op-tag-is-dragging, .op-tag-drop-target').forEach((element) => {
			element.removeClass('op-tag-is-dragging', 'op-tag-drop-target');
		});
		dropTarget = null;
	};
	const applyTagGroups = () => {
		const rootEntries = Array.from(ownerDocument.querySelectorAll<HTMLElement>(TAG_ROW_SELECTOR)).flatMap((row) => {
			const wrapper = row.closest<HTMLElement>('.tree-item');
			if (!wrapper || wrapper.parentElement?.closest('.tree-item-children')) return [];
			const text = findBuiltinTagText(row);
			const path = text ? extractTagPath(row, text) : '';
			return path && !path.includes('/') ? [{ path, wrapper }] : [];
		});
		const containers = new Map<HTMLElement, typeof rootEntries>();
		for (const entry of rootEntries) {
			const container = entry.wrapper.parentElement;
			if (!container) continue;
			const entries = containers.get(container) ?? [];
			entries.push(entry);
			containers.set(container, entries);
		}
		for (const [container, entries] of containers) {
			const grouped = groupTags(entries.map((entry) => entry.path), manager.tagGroups, manager.tagGroupAssignments);
			const signature = JSON.stringify(grouped.map((group) => [group.groupId, group.name, group.tags]));
			const existingHeadings = Array.from(container.querySelectorAll<HTMLElement>(':scope > .op-tag-group-heading'));
			if (container.dataset.opTagGroupSignature === signature && existingHeadings.length === grouped.length) continue;
			container.querySelectorAll(':scope > .op-tag-group-heading').forEach((heading) => heading.remove());
			const wrappersByPath = new Map(entries.map((entry) => [entry.path, entry.wrapper]));
			for (const group of grouped) {
				const heading = ownerDocument.createElement('div');
				heading.className = 'op-tag-group-heading';
				heading.dataset.groupId = group.groupId ?? '';
				heading.createSpan({ text: group.name });
				heading.createSpan({ cls: 'op-tag-group-count', text: String(group.tags.length) });
				container.appendChild(heading);
				for (const tag of group.tags) {
					const wrapper = wrappersByPath.get(tag);
					if (wrapper) container.appendChild(wrapper);
				}
			}
			container.dataset.opTagGroupSignature = signature;
		}
	};
	const applyTagStyles = () => {
		styleRefreshQueued = false;
		if (!manager.nativeSidebarSettings.tagsEnabled) {
			ownerDocument.querySelectorAll('.op-tag-group-heading').forEach((element) => element.remove());
			for (const row of Array.from(ownerDocument.querySelectorAll<HTMLElement>(TAG_ROW_SELECTOR))) {
				findBuiltinTagText(row)?.style.removeProperty('color');
				row.querySelector(':scope .op-builtin-tag-style-icon')?.remove();
			}
			return;
		}
		for (const row of Array.from(ownerDocument.querySelectorAll<HTMLElement>(TAG_ROW_SELECTOR))) {
			if (row.querySelector('.op-builtin-tag-input')) continue;
			const text = findBuiltinTagText(row);
			if (!text) continue;
			const path = extractTagPath(row, text);
			if (!path) continue;
			const previousPath = row.dataset.opTagPath;
			const staleStyle = previousPath && previousPath !== path ? manager.tagStyles[previousPath] : undefined;
			if (previousPath && staleStyle && !manager.tagStyles[path] && !styleMigrations.has(previousPath)) {
				styleMigrations.add(previousPath);
				void manager.moveTagStyle(previousPath, path).finally(() => styleMigrations.delete(previousPath));
			}
			row.dataset.opTagPath = path;
			const style = manager.tagStyles[path] ?? staleStyle;
			text.style.color = style?.color ?? '';
			const iconHost = row.querySelector<HTMLElement>('.tree-item-inner') ?? row;
			const currentIcon = iconHost.querySelector<HTMLElement>(':scope > .op-builtin-tag-style-icon');
			const desiredIcon = style?.icon ?? '';
			if (row.dataset.opTagIcon !== desiredIcon || Boolean(currentIcon) !== Boolean(desiredIcon)) {
				currentIcon?.remove();
				row.dataset.opTagIcon = desiredIcon;
				if (style?.icon) {
					const icon = ownerDocument.createElement('span');
					icon.className = 'op-builtin-tag-style-icon';
					icon.style.color = style.color ?? '';
					icon.setAttribute('aria-hidden', 'true');
					if (/^[a-z0-9][a-z0-9-]*$/iu.test(style.icon)) {
						setIcon(icon, style.icon);
						if (!icon.querySelector('svg')) icon.setText(style.icon);
					} else icon.setText(style.icon);
					iconHost.insertBefore(icon, iconHost.firstChild);
				}
			} else if (currentIcon) currentIcon.style.color = style?.color ?? '';
		}
		applyTagGroups();
	};
	const scheduleTagStyleRefresh = () => {
		if (styleRefreshQueued) return;
		styleRefreshQueued = true;
		if (ownerDocument.defaultView) styleRefreshTimer = ownerDocument.defaultView.setTimeout(applyTagStyles, 0);
		else applyTagStyles();
	};
	const Observer = ownerDocument.defaultView?.MutationObserver;
	const observer = Observer ? new Observer(scheduleTagStyleRefresh) : null;
	observer?.observe(ownerDocument.body, { childList: true, subtree: true });
	plugin.register(() => {
		observer?.disconnect();
		if (styleRefreshTimer !== undefined) ownerDocument.defaultView?.clearTimeout(styleRefreshTimer);
	});
	plugin.register(manager.onChange(scheduleTagStyleRefresh));
	applyTagStyles();
	plugin.registerDomEvent(ownerDocument, 'contextmenu', (event) => {
		if (!manager.nativeSidebarSettings.tagsEnabled) return;
		const target = elementFromEvent(event);
		const groupHeading = target?.closest<HTMLElement>('.op-tag-group-heading');
		if (groupHeading) {
			event.preventDefault();
			event.stopPropagation();
			const group = manager.tagGroups.find((item) => item.id === groupHeading.dataset.groupId);
			const menu = new Menu();
			menu.addItem((item) => item
				.setTitle('新建标签分组')
				.setIcon('folder-plus')
				.onClick(() => new TagGroupModal(manager).open()));
			menu.addItem((item) => item
				.setTitle('编辑标签分组')
				.setIcon('folder-cog')
				.setDisabled(!group)
				.onClick(() => { if (group) new TagGroupModal(manager, group).open(); }));
			menu.addItem((item) => item
				.setTitle('删除标签分组')
				.setIcon('trash-2')
				.setWarning(true)
				.setDisabled(!group)
				.onClick(() => { if (group) void manager.deleteTagGroup(group.id); }));
			menu.showAtMouseEvent(event);
			return;
		}
		const row = target?.closest<HTMLElement>(TAG_ROW_SELECTOR);
		const text = row ? findBuiltinTagText(row) : null;
		if (!row || !text) return;
		const path = extractTagPath(row, text);
		if (!path) return;
		event.preventDefault();
		event.stopPropagation();
		const menu = new Menu();
		menu.addItem((item) => item
			.setTitle('编辑标签样式')
			.setIcon('palette')
			.onClick(() => new TagStyleModal(manager, path, scheduleTagStyleRefresh).open()));
		menu.addItem((item) => item
			.setTitle('设置标签分组')
			.setIcon('folder-input')
			.onClick(() => new TagGroupAssignmentModal(manager, path).open()));
		menu.addItem((item) => item
			.setTitle('新建标签分组')
			.setIcon('folder-plus')
			.onClick(() => new TagGroupModal(manager).open()));
		menu.showAtMouseEvent(event);
	});
	plugin.registerDomEvent(ownerDocument, 'pointerdown', (event) => {
		if (!manager.nativeSidebarSettings.tagsEnabled) return;
		const row = elementFromEvent(event)?.closest<HTMLElement>(TAG_ROW_SELECTOR);
		if (row) row.draggable = true;
	});
	plugin.registerDomEvent(ownerDocument, 'dragstart', (event) => {
		if (!manager.nativeSidebarSettings.tagsEnabled) return;
		const row = elementFromEvent(event)?.closest<HTMLElement>(TAG_ROW_SELECTOR);
		const text = row ? findBuiltinTagText(row) : null;
		if (!row || !text || !event.dataTransfer) return;
		const path = extractTagPath(row, text);
		if (!path) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData(TAG_DRAG_TYPE, path);
		row.addClass('op-tag-is-dragging');
	});
	plugin.registerDomEvent(ownerDocument, 'dragover', (event) => {
		if (!manager.nativeSidebarSettings.tagsEnabled) return;
		const target = elementFromEvent(event);
		const row = target?.closest<HTMLElement>(TAG_ROW_SELECTOR) ?? null;
		const container = target?.closest<HTMLElement>(TAG_CONTAINER_SELECTOR);
		if (!row && !container) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		if (dropTarget !== row) {
			dropTarget?.removeClass('op-tag-drop-target');
			dropTarget = row;
			dropTarget?.addClass('op-tag-drop-target');
		}
	});
	plugin.registerDomEvent(ownerDocument, 'drop', (event) => {
		if (!manager.nativeSidebarSettings.tagsEnabled) return;
		const target = elementFromEvent(event);
		const row = target?.closest<HTMLElement>(TAG_ROW_SELECTOR) ?? null;
		const container = target?.closest<HTMLElement>(TAG_CONTAINER_SELECTOR);
		if ((!row && !container) || !event.dataTransfer) return;
		event.preventDefault();
		event.stopPropagation();
		const dragged = normalizeTagPath(event.dataTransfer.getData(TAG_DRAG_TYPE));
		const targetText = row ? findBuiltinTagText(row) : null;
		const parent = row && targetText ? extractTagPath(row, targetText) : null;
		const nextPath = dragged ? reparentTagPath(dragged, parent) : null;
		clearDragState();
		if (!dragged || !nextPath) return;
		const existing = new Set(manager.index.validTasks().flatMap((task) => task.document.metadata.tags));
		if (existing.has(nextPath)) {
			new Notice(`标签已存在：#${nextPath}`);
			return;
		}
		void manager.renameTag(dragged, nextPath).catch((error) => {
			new Notice(error instanceof Error ? error.message : String(error));
		});
	});
	plugin.registerDomEvent(ownerDocument, 'dragend', clearDragState);
	plugin.registerDomEvent(ownerDocument, 'dblclick', (event) => {
		if (!manager.nativeSidebarSettings.tagsEnabled) return;
		const target = elementFromEvent(event);
		if (!target) return;
		const row = target.closest<HTMLElement>(TAG_ROW_SELECTOR);
		if (!row || row.querySelector('.op-builtin-tag-input')) return;
		const text = findBuiltinTagText(row);
		if (!text) return;
		const oldPath = extractTagPath(row, text);
		if (!oldPath) return;

		event.preventDefault();
		event.stopPropagation();
		const originalText = text.textContent ?? `#${oldPath}`;
		const input = ownerDocument.createElement('input');
		input.type = 'text';
		input.className = 'op-builtin-tag-input';
		input.value = oldPath;
		input.setAttribute('aria-label', `重命名标签 ${oldPath}`);
		text.replaceChildren(input);
		let finished = false;
		let submitting = false;

		const restore = (label = originalText) => {
			if (finished) return;
			finished = true;
			text.replaceChildren(ownerDocument.createTextNode(label));
		};
		const submit = async () => {
			if (finished || submitting) return;
			const nextPath = normalizeTagPath(input.value);
			if (!nextPath || nextPath === oldPath) {
				restore();
				return;
			}
			submitting = true;
			input.disabled = true;
			try {
				await manager.renameTag(oldPath, nextPath);
				row.dataset.opTagPath = nextPath;
				restore(nextPath.split('/').filter(Boolean).at(-1) ?? nextPath);
			} catch (error) {
				submitting = false;
				input.disabled = false;
				new Notice(error instanceof Error ? error.message : String(error));
				input.focus();
			}
		};

		input.addEventListener('keydown', (keyboardEvent) => {
			if (keyboardEvent.key === 'Enter') {
				keyboardEvent.preventDefault();
				void submit();
			} else if (keyboardEvent.key === 'Escape') {
				keyboardEvent.preventDefault();
				restore();
			}
		});
		input.addEventListener('blur', () => void submit(), { once: true });
		input.focus();
		input.select();
	});
}
