import { expect, it } from 'vitest';
import { displayDateTime, fromDateTimeLocalInput, toDateTimeLocalInput } from '../../src/utils/dates';

it('converts graphical local date-time values without losing the device offset', () => {
	expect(toDateTimeLocalInput('2026-07-12T14:30:45+08:00')).toBe('2026-07-12T14:30');
	expect(fromDateTimeLocalInput('2026-07-12T14:30', -480)).toBe('2026-07-12T14:30:00+08:00');
	expect(fromDateTimeLocalInput('')).toBeNull();
});

it('shows only local date and minute information for stored date-times', () => {
	expect(displayDateTime('2026-07-12T14:30:45+08:00')).toBe('2026-07-12 14:30');
	expect(displayDateTime('2026-07-12')).toBe('2026-07-12');
});
