import { describe, expect, it } from 'vitest';
import * as columnWidths from '../../src/views/column-widths';

const { resizeColumnWidth } = columnWidths;

describe('project list column widths', () => {
	it('clamps dragged widths to usable bounds', () => {
		expect(resizeColumnWidth(120, -200)).toBe(72);
		expect(resizeColumnWidth(120, 60)).toBe(180);
		expect(resizeColumnWidth(500, 200)).toBe(640);
	});

	it('sums visible pixel widths so the list can scroll horizontally', () => {
		const total = (columnWidths as Record<string, unknown>).totalColumnWidth as undefined | ((widths: number[]) => number);
		expect(typeof total).toBe('function');
		if (!total) return;
		expect(total([110, 260, 140])).toBe(510);
	});
});
