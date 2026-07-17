import { setIcon } from 'obsidian';

export interface ProjectReferencePresentation {
	key: string;
	title: string;
	icon?: string;
	color?: string;
}

export interface PersonReferencePresentation {
	name: string;
	sourcePath?: string;
	title?: string;
	icon?: string;
	color?: string;
}

function addIcon(parent: HTMLElement, icon: string | undefined): void {
	if (!icon) return;
	const marker = parent.ownerDocument.createElement('span');
	marker.className = 'op-reference-icon';
	marker.setAttribute('aria-hidden', 'true');
	parent.append(marker);
	if (/^[a-z0-9][a-z0-9-]*$/iu.test(icon)) setIcon(marker, icon);
	else marker.textContent = icon;
}

function appendSpan(parent: HTMLElement, className: string, text: string): void {
	const span = parent.ownerDocument.createElement('span');
	span.className = className;
	span.textContent = text;
	parent.append(span);
}

function decodeLinkTarget(value: string): string {
	try { return decodeURIComponent(value); }
	catch { return value; }
}

function projectLinkCandidates(link: HTMLElement): string[] {
	const values = [link.dataset.href, link.getAttribute('href'), link.textContent]
		.filter((value): value is string => Boolean(value?.trim()));
	const candidates = new Set<string>();
	for (const value of values) {
		const decoded = decodeLinkTarget(value.trim()).replace(/\\/gu, '/').split('#', 1)[0] ?? '';
		if (!decoded) continue;
		candidates.add(decoded.replace(/\.md$/iu, ''));
		const basename = decoded.split('/').pop()?.replace(/\.md$/iu, '');
		if (basename) candidates.add(basename);
	}
	return [...candidates];
}

function decorateProjects(root: HTMLElement, projects: readonly ProjectReferencePresentation[]): void {
	const byKey = new Map(projects.map((project) => [project.key.toLocaleLowerCase(), project]));
	for (const link of Array.from(root.querySelectorAll<HTMLElement>('a.internal-link'))) {
		if (link.classList.contains('op-project-reference')) continue;
		const project = projectLinkCandidates(link)
			.map((candidate) => byKey.get(candidate.toLocaleLowerCase()))
			.find((candidate): candidate is ProjectReferencePresentation => Boolean(candidate));
		if (!project) continue;
		link.replaceChildren();
		link.classList.add('op-project-reference');
		link.style.color = project.color ?? '';
		link.title = project.title;
		addIcon(link, project.icon);
		appendSpan(link, 'op-project-reference-key', project.key);
		appendSpan(link, 'op-project-reference-title', project.title);
	}
}

function decoratePeople(root: HTMLElement, people: readonly PersonReferencePresentation[]): void {
	const byName = new Map([...people].sort((left, right) => right.name.length - left.name.length).map((person) => [person.name, person]));
	const names = [...byName.keys()];
	if (names.length === 0) return;
	const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));
	const pattern = new RegExp(`@(${escaped.join('|')})(?![\\p{L}\\p{N}_-])`, 'gu');
	const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			const parent = node.parentElement;
			if (!parent || parent.closest('code, pre, a, .op-person-reference')) return NodeFilter.FILTER_REJECT;
			pattern.lastIndex = 0;
			return pattern.test(node.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
		},
	});
	const nodes: Text[] = [];
	while (walker.nextNode()) nodes.push(walker.currentNode as Text);
	for (const node of nodes) {
		const source = node.nodeValue ?? '';
		const fragment = root.ownerDocument.createDocumentFragment();
		let offset = 0;
		pattern.lastIndex = 0;
		for (const match of source.matchAll(pattern)) {
			fragment.append(source.slice(offset, match.index));
			const matchedName = match[1];
			if (!matchedName) continue;
			const person = byName.get(matchedName);
			if (!person) continue;
			const reference = root.ownerDocument.createElement(person.sourcePath ? 'a' : 'span');
			reference.className = person.sourcePath ? 'internal-link op-person-reference' : 'op-person-reference';
			if (person.sourcePath) {
				reference.setAttribute('data-href', person.sourcePath);
				reference.setAttribute('href', person.sourcePath);
			}
			reference.style.color = person.color ?? '';
			reference.title = person.title ?? person.name;
			addIcon(reference, person.icon);
			appendSpan(reference, '', person.name);
			fragment.append(reference);
			offset = match.index + match[0].length;
		}
		fragment.append(source.slice(offset));
		node.replaceWith(fragment);
	}
}

export function decorateMarkdownReferences(
	root: HTMLElement,
	projects: readonly ProjectReferencePresentation[],
	people: readonly PersonReferencePresentation[],
): void {
	decorateProjects(root, projects);
	decoratePeople(root, people);
}

export async function decorateMarkdownReferencesWhenReady(
	root: HTMLElement,
	ready: Promise<void>,
	projects: () => readonly ProjectReferencePresentation[],
	people: () => readonly PersonReferencePresentation[],
): Promise<void> {
	await ready;
	decorateMarkdownReferences(root, projects(), people());
}
