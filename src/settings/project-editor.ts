import type { ProjectConfig } from '../domain/types';
import { ProjectConfigModal } from '../modals/project-config-modal';
import type { ProjectManager } from '../services/project-manager';

export class ProjectSettingsEditor {
	private readonly editor: ProjectConfigModal;

	constructor(manager: ProjectManager, project: ProjectConfig) {
		this.editor = new ProjectConfigModal(manager, project);
	}

	mount(container: HTMLElement, onExit: () => void): void {
		this.editor.mount(container, onExit);
	}
}
