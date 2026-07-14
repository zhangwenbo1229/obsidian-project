import { Component, MarkdownRenderer, Platform, type App } from 'obsidian';

export type MarkdownEditorMode = 'edit' | 'preview' | 'split';

interface MarkdownEditorOptions {
	app: App;
	container: HTMLElement;
	value: string;
	onChange(value: string): void;
	sourcePath: string;
	placeholder?: string;
	initialMode?: MarkdownEditorMode;
}

export interface MarkdownEditorHandle {
	unload(): void;
}

export function renderMarkdownEditor(options: MarkdownEditorOptions): MarkdownEditorHandle {
	const root = options.container.createDiv({ cls: 'op-markdown-editor-shell' });
	const toolbar = root.createDiv({ cls: 'op-markdown-editor-toolbar', attr: { role: 'group', 'aria-label': 'Markdown 编辑模式' } });
	const surface = root.createDiv({ cls: 'op-markdown-editor-surface' });
	const textarea = surface.createEl('textarea', { cls: 'op-markdown-editor op-markdown-editor-source' });
	textarea.value = options.value;
	textarea.placeholder = options.placeholder ?? '';
	const preview = surface.createDiv({ cls: 'op-markdown-editor-preview markdown-rendered' });
	let mode: MarkdownEditorMode = options.initialMode ?? (Platform.isMobile ? 'edit' : 'split');
	let timer: number | undefined;
	let previewComponent: Component | null = null;
	let renderGeneration = 0;
	const owner = new Component();
	owner.load();

	const renderPreview = async () => {
		if (!preview.isConnected) return;
		const generation = ++renderGeneration;
		previewComponent?.unload();
		previewComponent = new Component();
		previewComponent.load();
		if (!textarea.value.trim()) {
			preview.empty();
			preview.createDiv({ cls: 'op-markdown-editor-empty', text: '暂无内容' });
			return;
		}
		const staging = preview.ownerDocument.createElement('div');
		await MarkdownRenderer.render(options.app, textarea.value, staging, options.sourcePath, previewComponent);
		if (generation !== renderGeneration || !preview.isConnected) return;
		preview.replaceChildren(...Array.from(staging.childNodes));
	};
	const schedulePreview = () => {
		window.clearTimeout(timer);
		timer = window.setTimeout(() => void renderPreview(), 200);
	};
	const applyMode = (nextMode: MarkdownEditorMode) => {
		mode = nextMode;
		root.dataset.mode = mode;
		toolbar.querySelectorAll<HTMLButtonElement>('.op-markdown-editor-mode').forEach((button) => {
			button.toggleClass('is-active', button.dataset.mode === mode);
			button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
		});
		if (mode !== 'edit') void renderPreview();
	};

	for (const [value, label] of [['edit', '编辑'], ['preview', '预览'], ['split', '分栏']] as const) {
		const button = toolbar.createEl('button', { cls: 'op-markdown-editor-mode', text: label, attr: { type: 'button' } });
		button.dataset.mode = value;
		button.addEventListener('click', () => applyMode(value));
	}
	textarea.addEventListener('input', () => {
		options.onChange(textarea.value);
		if (mode !== 'edit') schedulePreview();
	});
	owner.register(() => {
		window.clearTimeout(timer);
		previewComponent?.unload();
	});
	applyMode(mode);
	return { unload: () => owner.unload() };
}
