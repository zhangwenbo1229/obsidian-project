import type { FieldPresentation } from '../views/field-presentation';
import { applyLabelPresentation } from '../views/field-presentation';

export interface TaskDialogShell {
	gridEl: HTMLElement;
	createSection(title: string, className?: string, presentation?: FieldPresentation): HTMLElement;
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
		createSection(title, className, presentation) {
			const sectionEl = gridEl.createDiv({
				cls: ['op-task-dialog-section', className].filter(Boolean).join(' '),
			});
			const heading = sectionEl.createEl('h3', { text: title });
			applyLabelPresentation(heading, presentation);
			return sectionEl.createDiv({ cls: 'op-task-dialog-section-body' });
		},
		footerEl,
	};
}
