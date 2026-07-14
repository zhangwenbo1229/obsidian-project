export interface TaskDialogShell {
	gridEl: HTMLElement;
	createSection(title: string, className?: string): HTMLElement;
	footerEl: HTMLElement;
}

export function buildTaskDialogShell(
	contentEl: HTMLElement,
	options: { subtitle?: string } = {},
): TaskDialogShell {
	contentEl.empty();
	contentEl.addClass('op-task-dialog');

	if (options.subtitle) {
		contentEl.createDiv({ cls: 'op-task-dialog-subtitle', text: options.subtitle });
	}

	const gridEl = contentEl.createDiv({ cls: 'op-task-dialog-grid' });
	const footerEl = contentEl.createDiv({ cls: 'op-task-dialog-footer' });

	return {
		gridEl,
		createSection(title, className) {
			const sectionEl = gridEl.createDiv({
				cls: ['op-task-dialog-section', className].filter(Boolean).join(' '),
			});
			sectionEl.createEl('h3', { text: title });
			return sectionEl.createDiv({ cls: 'op-task-dialog-section-body' });
		},
		footerEl,
	};
}
