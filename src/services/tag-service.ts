import type { TagStyle } from '../domain/types';

export function renameTagPath(
	tags: readonly string[],
	oldPath: string,
	newPath: string,
): string[] {
	const normalizedOld = oldPath.trim().replace(/^#|\/$/gu, '');
	const normalizedNew = newPath.trim().replace(/^#|\/$/gu, '');
	if (!normalizedOld || !normalizedNew) throw new Error('标签路径不能为空。');
	return [...new Set(tags.map((tag) => {
		if (tag === normalizedOld) return normalizedNew;
		if (tag.startsWith(`${normalizedOld}/`)) return `${normalizedNew}${tag.slice(normalizedOld.length)}`;
		return tag;
	}))];
}

export function renameTagStyles(
	styles: Readonly<Record<string, TagStyle>>,
	oldPath: string,
	newPath: string,
): Record<string, TagStyle> {
	return Object.fromEntries(Object.entries(styles).map(([path, style]) => {
		const nextPath = path === oldPath
			? newPath
			: path.startsWith(`${oldPath}/`)
				? `${newPath}${path.slice(oldPath.length)}`
				: path;
		return [nextPath, structuredClone(style)];
	}));
}

export function moveTagStylePath(
	styles: Readonly<Record<string, TagStyle>>,
	oldPath: string,
	newPath: string,
): Record<string, TagStyle> {
	const next: Record<string, TagStyle> = structuredClone(styles);
	const style = next[oldPath];
	if (!style || oldPath === newPath) return next;
	if (!next[newPath]) next[newPath] = style;
	delete next[oldPath];
	return next;
}

export function repairMalformedTagStyles(
	styles: Readonly<Record<string, TagStyle>>,
	knownTags: ReadonlySet<string>,
): Record<string, TagStyle> {
	let next: Record<string, TagStyle> = structuredClone(styles);
	for (const path of Object.keys(styles)) {
		if (knownTags.has(path)) continue;
		const corrected = [...knownTags]
			.filter((tag) => path.startsWith(tag) && /^\d+$/u.test(path.slice(tag.length)))
			.sort((left, right) => right.length - left.length)[0];
		if (corrected) next = moveTagStylePath(next, path, corrected);
	}
	return next;
}

export function reorderTagPaths(
	order: readonly string[],
	dragged: string,
	target: string,
): string[] {
	if (dragged === target) return [...order];
	const next = order.filter((item) => item !== dragged);
	const targetIndex = next.indexOf(target);
	if (targetIndex < 0) return [...next, dragged];
	next.splice(targetIndex, 0, dragged);
	return next;
}

export function reparentTagPath(
	dragged: string,
	parent: string | null,
): string | null {
	const normalizedDragged = dragged.trim().replace(/^#|\/$/gu, '');
	const normalizedParent = parent?.trim().replace(/^#|\/$/gu, '') || '';
	if (!normalizedDragged) return null;
	if (
		normalizedParent === normalizedDragged ||
		normalizedParent.startsWith(`${normalizedDragged}/`)
	) return null;
	const name = normalizedDragged.split('/').filter(Boolean).at(-1)!;
	const next = normalizedParent ? `${normalizedParent}/${name}` : name;
	return next === normalizedDragged ? null : next;
}
