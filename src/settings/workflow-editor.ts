import { setIcon, Setting } from 'obsidian';
import type { WorkflowDefinition, WorkflowStatus } from '../domain/types';
import { createUuid } from '../utils/ids';

const NODE_WIDTH = 164;
const NODE_HEIGHT = 74;

function defaultPosition(index: number): { x: number; y: number } {
	return { x: 20 + (index % 3) * 196, y: 22 + Math.floor(index / 3) * 120 };
}

export function connectWorkflowStatuses(
	workflow: WorkflowDefinition,
	from: string,
	to: string,
	id = createUuid(),
): boolean {
	if (from === to || workflow.transitions.some((transition) => transition.from === from && transition.to === to)) return false;
	const fromStatus = workflow.statuses.find((status) => status.id === from);
	const toStatus = workflow.statuses.find((status) => status.id === to);
	if (!fromStatus || !toStatus) return false;
	workflow.transitions.push({ id, name: `${fromStatus.name} → ${toStatus.name}`, from, to });
	return true;
}

export function renderWorkflowEditor(
	container: HTMLElement,
	workflow: WorkflowDefinition,
	render: () => void,
): void {
	const canvas = container.createDiv({ cls: 'op-workflow-canvas' });
	const stage = canvas.createDiv({ cls: 'op-workflow-stage' });
	const svg = stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.classList.add('op-workflow-edges');
	svg.setAttribute('aria-hidden', 'true');
	stage.appendChild(svg);
	const definitions = stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'defs');
	const arrow = stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'marker');
	arrow.setAttribute('id', 'op-workflow-arrowhead');
	arrow.setAttribute('viewBox', '0 0 10 10');
	arrow.setAttribute('refX', '9');
	arrow.setAttribute('refY', '5');
	arrow.setAttribute('markerWidth', '6');
	arrow.setAttribute('markerHeight', '6');
	arrow.setAttribute('orient', 'auto-start-reverse');
	const arrowPath = stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
	arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
	arrow.appendChild(arrowPath);
	definitions.appendChild(arrow);
	svg.appendChild(definitions);
	const nodeElements = new Map<string, HTMLElement>();
	let connectingFrom = '';

	const drawEdges = () => {
		if (!stage.isConnected) return;
		svg.querySelectorAll('.op-workflow-edge').forEach((edge) => edge.remove());
		stage.querySelectorAll('.op-workflow-edge-label').forEach((label) => label.remove());
		for (const transition of workflow.transitions) {
			const from = workflow.statuses.find((status) => status.id === transition.from);
			const to = workflow.statuses.find((status) => status.id === transition.to);
			if (!from || !to) continue;
			const fromPosition = from.position ?? defaultPosition(workflow.statuses.indexOf(from));
			const toPosition = to.position ?? defaultPosition(workflow.statuses.indexOf(to));
			const startX = fromPosition.x + NODE_WIDTH;
			const startY = fromPosition.y + NODE_HEIGHT / 2;
			const endX = toPosition.x;
			const endY = toPosition.y + NODE_HEIGHT / 2;
			const curve = Math.max(44, Math.abs(endX - startX) / 2);
			const path = stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.classList.add('op-workflow-edge');
			path.setAttribute('d', `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`);
			path.setAttribute('marker-end', 'url(#op-workflow-arrowhead)');
			const title = stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'title');
			title.textContent = transition.name;
			path.appendChild(title);
			svg.appendChild(path);
			const label = stage.createDiv({ cls: 'op-workflow-edge-label', text: transition.name });
			label.style.left = `${(startX + endX) / 2}px`;
			label.style.top = `${(startY + endY) / 2}px`;
		}
	};

	for (const [index, status] of workflow.statuses.entries()) {
		status.position ??= defaultPosition(index);
		const node = stage.createDiv({ cls: `op-workflow-node is-${status.category}` });
		node.dataset.statusId = status.id;
		node.style.left = `${status.position.x}px`;
		node.style.top = `${status.position.y}px`;
		node.createSpan({ cls: 'op-workflow-node-dot' });
		node.createEl('strong', { text: status.name });
		node.createEl('small', { text: status.id });
		if (workflow.initialStatusId === status.id) node.createSpan({ cls: 'op-workflow-initial', text: '初始' });
		const connect = node.createEl('button', { cls: 'op-workflow-connect', attr: { type: 'button', title: '连接状态', 'aria-label': `从 ${status.name} 连接` } });
		setIcon(connect, 'git-branch-plus');
		connect.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			connectingFrom = connectingFrom === status.id ? '' : status.id;
			for (const element of nodeElements.values()) element.toggleClass('is-connecting', element.dataset.statusId === connectingFrom);
		});
		node.addEventListener('click', () => {
			if (!connectingFrom || connectingFrom === status.id) return;
			connectWorkflowStatuses(workflow, connectingFrom, status.id);
			connectingFrom = '';
			render();
		});
		node.addEventListener('pointerdown', (event) => {
			if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
			event.preventDefault();
			const startX = event.clientX;
			const startY = event.clientY;
			const origin = { ...status.position! };
			let moved = false;
			node.setPointerCapture(event.pointerId);
			const move = (moveEvent: PointerEvent) => {
				moved = true;
				status.position = {
					x: Math.max(8, Math.min(stage.clientWidth - NODE_WIDTH - 8, origin.x + moveEvent.clientX - startX)),
					y: Math.max(8, origin.y + moveEvent.clientY - startY),
				};
				node.style.left = `${status.position.x}px`;
				node.style.top = `${status.position.y}px`;
				drawEdges();
			};
			const finish = () => {
				node.removeEventListener('pointermove', move);
				if (moved) render();
			};
			node.addEventListener('pointermove', move);
			node.addEventListener('pointerup', finish, { once: true });
			node.addEventListener('pointercancel', finish, { once: true });
		});
		nodeElements.set(status.id, node);
	}
	stage.ownerDocument.defaultView?.requestAnimationFrame(drawEdges);

	const editor = container.createDiv({ cls: 'op-workflow-editor' });
	new Setting(editor).setName('初始状态').addDropdown((dropdown) => {
		for (const status of workflow.statuses) dropdown.addOption(status.id, status.name);
		dropdown.setValue(workflow.initialStatusId).onChange((value) => {
			workflow.initialStatusId = value;
			render();
		});
	});
	for (const status of workflow.statuses) renderStatusSetting(editor, workflow, status, render);
	new Setting(editor).addButton((button) => button.setButtonText('新增状态').onClick(() => {
		const id = `status-${workflow.statuses.length + 1}`;
		workflow.statuses.push({ id, name: '新状态', category: 'todo', result: null, active: true, position: defaultPosition(workflow.statuses.length) });
		if (!workflow.initialStatusId) workflow.initialStatusId = id;
		render();
	}));

	for (const transition of workflow.transitions) {
		new Setting(editor)
			.setName(transition.name)
			.addText((text) => text.setValue(transition.name).onChange((value) => (transition.name = value)))
			.addDropdown((dropdown) => {
				for (const status of workflow.statuses) dropdown.addOption(status.id, status.name);
				dropdown.setValue(transition.from).onChange((value) => { transition.from = value; render(); });
			})
			.addDropdown((dropdown) => {
				for (const status of workflow.statuses) dropdown.addOption(status.id, status.name);
				dropdown.setValue(transition.to).onChange((value) => { transition.to = value; render(); });
			})
			.addExtraButton((button) => button.setIcon('trash').setTooltip('删除转换').onClick(() => {
				workflow.transitions = workflow.transitions.filter((item) => item !== transition);
				render();
			}));
	}
	new Setting(editor).addButton((button) => button.setButtonText('新增状态转换').onClick(() => {
		const from = workflow.statuses[0]?.id;
		const to = workflow.statuses[1]?.id;
		if (from && to && connectWorkflowStatuses(workflow, from, to)) render();
	}));
}

function renderStatusSetting(
	editor: HTMLElement,
	workflow: WorkflowDefinition,
	status: WorkflowStatus,
	render: () => void,
): void {
	new Setting(editor)
		.setName(status.name)
		.addText((text) => text.setPlaceholder('状态 ID').setValue(status.id).onChange((value) => (status.id = value.trim())))
		.addText((text) => text.setPlaceholder('状态名称').setValue(status.name).onChange((value) => (status.name = value)))
		.addDropdown((dropdown) => dropdown
			.addOption('todo', '未开始')
			.addOption('in_progress', '处理中')
			.addOption('done', '已结束')
			.setValue(status.category)
			.onChange((value) => { status.category = value as typeof status.category; render(); }))
		.addExtraButton((button) => button.setIcon('trash').setTooltip('删除状态').onClick(() => {
			workflow.statuses = workflow.statuses.filter((item) => item !== status);
			workflow.transitions = workflow.transitions.filter((item) => item.from !== status.id && item.to !== status.id);
			if (workflow.initialStatusId === status.id) workflow.initialStatusId = workflow.statuses[0]?.id ?? '';
			render();
		}));
}
