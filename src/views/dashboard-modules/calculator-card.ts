import type { CalculatorDashboardModuleConfig } from '../../domain/types';
import { createModuleBody } from './card-ui';
import type { DashboardModuleDefinition, DashboardModuleRenderContext, DashboardModuleSettingsContext } from './types';
import { Setting } from 'obsidian';

function renderCalculator(context: DashboardModuleRenderContext): void {
	const config = context.card.moduleConfig as CalculatorDashboardModuleConfig;
	const body = createModuleBody(context.container, 'op-calculator-card');

	const display = body.createEl('input', {
		cls: 'op-calculator-display',
		attr: { type: 'text', readonly: 'true', value: config.expression || '0' },
	});

	const buttons = [
		['7', '8', '9', '/'],
		['4', '5', '6', '*'],
		['1', '2', '3', '-'],
		['0', '.', '=', '+'],
		['C', '⌫'],
	];

	let currentExpression = config.expression || '';
	let shouldReset = false;

	const updateDisplay = (value: string): void => {
		display.value = value || '0';
		currentExpression = value;
		// Persist to config
		config.expression = value;
	};

	const evaluate = (): void => {
		try {
			// Replace × with * and ÷ with / for evaluation
			let expr = currentExpression.replace(/×/g, '*').replace(/÷/g, '/');
			// Only allow safe characters
			if (!/^[\d+\-*/().\s]*$/.test(expr)) {
				updateDisplay('Error');
				shouldReset = true;
				return;
			}
			// eslint-disable-next-line no-new-func
			const result = new Function(`return (${expr})`)() as number;
			if (!Number.isFinite(result)) {
				updateDisplay('Error');
				shouldReset = true;
				return;
			}
			updateDisplay(String(Math.round(result * 1e10) / 1e10));
			shouldReset = true;
		} catch {
			updateDisplay('Error');
			shouldReset = true;
		}
	};

	for (const row of buttons) {
		const rowEl = body.createDiv({ cls: 'op-calculator-row' });
		for (const btn of row) {
			const button = rowEl.createEl('button', {
				cls: `op-calculator-btn${btn === '=' ? ' is-equals' : ''}${btn === 'C' || btn === '⌫' ? ' is-action' : ''}${['/', '*', '-', '+'].includes(btn) ? ' is-operator' : ''}`,
				text: btn,
				attr: { type: 'button' },
			});
			button.addEventListener('click', (event) => {
				event.preventDefault();
				if (btn === 'C') {
					updateDisplay('');
					shouldReset = false;
				} else if (btn === '⌫') {
					updateDisplay(currentExpression.slice(0, -1));
				} else if (btn === '=') {
					evaluate();
				} else {
					if (shouldReset) {
						updateDisplay(btn);
						shouldReset = false;
					} else {
						updateDisplay(currentExpression + btn);
					}
				}
			});
		}
	}
}

function renderCalculatorSettings(context: DashboardModuleSettingsContext): void {
	const container = context.container;
	container.createEl('h3', { text: '计算器' });
	container.createEl('p', { text: '无需额外配置，直接在卡片上点击按钮进行计算。' });
}

export const calculatorDefinition: DashboardModuleDefinition = {
	kind: 'calculator',
	label: '计算器',
	icon: 'calculator',
	render: renderCalculator,
	renderSettings: renderCalculatorSettings,
};