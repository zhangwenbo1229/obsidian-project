import type { IndexedTask } from '../index/task-index';
import type { ProjectManager } from '../services/project-manager';

export function renderTaskRelations(parent: HTMLElement, task: IndexedTask, manager: ProjectManager): void {
	for (const relation of task.document.relations.filter((item) => item.type === 'related')) {
		const target = manager.index.get(relation.targetUid);
		if (!target) {
			parent.createSpan({
				cls: 'op-task-relation-link is-missing',
				text: `${relation.targetKey} · ${relation.targetTitle}`,
				attr: { 'aria-disabled': 'true', title: '关联任务不存在' },
			});
			continue;
		}
		const link = parent.createEl('a', {
			cls: 'op-task-relation-link internal-link',
			text: `${relation.targetKey} · ${relation.targetTitle}`,
			href: target.path,
			attr: { 'data-href': target.path, title: `打开 ${relation.targetKey}` },
		});
		link.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			void manager.openTask(target.path);
		});
	}
}
