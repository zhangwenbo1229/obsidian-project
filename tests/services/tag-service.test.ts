import { describe, expect, it } from 'vitest';
import * as tagService from '../../src/services/tag-service';

const { reorderTagPaths, renameTagPath } = tagService;

describe('tag editing', () => {
	it('renames a parent path and all descendants while deduplicating collisions', () => {
		expect(renameTagPath(
			['work', 'work/backend', 'work/backend/api', 'office/backend/api'],
			'work',
			'office',
		)).toEqual(['office', 'office/backend', 'office/backend/api']);
	});

	it('moves configured tag styles with renamed parents and descendants', () => {
		const renameStyles = (tagService as Record<string, unknown>).renameTagStyles as undefined | ((
			styles: Record<string, { icon?: string; color?: string }>,
			oldPath: string,
			newPath: string,
		) => Record<string, { icon?: string; color?: string }>);
		expect(typeof renameStyles).toBe('function');
		if (!renameStyles) return;
		expect(renameStyles({
			work: { icon: 'briefcase', color: '#0052cc' },
			'work/backend': { icon: 'server' },
			personal: { color: '#36b37e' },
		}, 'work', 'office')).toEqual({
			office: { icon: 'briefcase', color: '#0052cc' },
			'office/backend': { icon: 'server' },
			personal: { color: '#36b37e' },
		});
	});

	it('moves one malformed tag style key to the corrected tag path', () => {
		const moveStyle = (tagService as Record<string, unknown>).moveTagStylePath as undefined | ((
			styles: Record<string, { icon?: string; color?: string }>,
			oldPath: string,
			newPath: string,
		) => Record<string, { icon?: string; color?: string }>);
		expect(typeof moveStyle).toBe('function');
		if (!moveStyle) return;
		expect(moveStyle({ frontend1: { icon: 'package-check', color: '#0c66e4' } }, 'frontend1', 'frontend')).toEqual({
			frontend: { icon: 'package-check', color: '#0c66e4' },
		});
	});

	it('repairs count-suffixed style paths from the known task tag catalog', () => {
		const repair = (tagService as Record<string, unknown>).repairMalformedTagStyles as undefined | ((
			styles: Record<string, { icon?: string; color?: string }>,
			knownTags: ReadonlySet<string>,
		) => Record<string, { icon?: string; color?: string }>);
		expect(typeof repair).toBe('function');
		if (!repair) return;
		expect(repair({
			frontend1: { icon: 'package-check' },
			'test/calendar1': { color: '#0052cc' },
			legal2: { icon: 'star' },
		}, new Set(['frontend', 'test/calendar', 'legal2']))).toEqual({
			frontend: { icon: 'package-check' },
			'test/calendar': { color: '#0052cc' },
			legal2: { icon: 'star' },
		});
	});

	it('moves a dragged tag before a target while keeping unspecified tags stable', () => {
		expect(reorderTagPaths(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
	});

	it('reparents a dragged tag while rejecting hierarchy cycles', () => {
		const reparent = (tagService as Record<string, unknown>).reparentTagPath as undefined | ((dragged: string, parent: string | null) => string | null);
		expect(typeof reparent).toBe('function');
		if (!reparent) return;
		expect(reparent('work/backend', 'personal')).toBe('personal/backend');
		expect(reparent('work/backend', null)).toBe('backend');
		expect(reparent('work', 'work/backend')).toBeNull();
		expect(reparent('work', 'work')).toBeNull();
	});
});
