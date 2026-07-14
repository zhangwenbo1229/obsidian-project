export interface NewsItem {
	title: string;
	url: string;
	summary: string;
	publishedAt: number;
	feedTitle: string;
	sourceUrl: string;
}

export interface ParsedSyndicationFeed {
	feedTitle: string;
	items: NewsItem[];
}

export interface NewsLoadResult {
	items: NewsItem[];
	errors: Array<{ url: string; message: string }>;
}

type NewsRequest = (url: string) => Promise<string>;

const XML_ENTITIES: Record<string, string> = {
	amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntities(value: string): string {
	return value
		.replace(/&#x([0-9a-f]+);/giu, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
		.replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&([a-z]+);/giu, (entity, name: string) => XML_ENTITIES[name.toLowerCase()] ?? entity);
}

export function stripMarkup(value: string): string {
	return decodeEntities(value
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
		.replace(/<[^>]*>/gu, ' '))
		.replace(/\s+/gu, ' ')
		.trim();
}

function extractTag(block: string, tagNames: readonly string[]): string {
	for (const tag of tagNames) {
		const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'iu'));
		if (match?.[1]) return stripMarkup(match[1]);
	}
	return '';
}

function extractLink(block: string): string {
	const href = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?\s*>/iu)?.[1];
	return decodeEntities(href ?? extractTag(block, ['link']));
}

function timestamp(value: string): number {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function safeArticleUrl(value: string, sourceUrl: string): string {
	try {
		const url = new URL(value, sourceUrl);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
	} catch {
		return '';
	}
}

export function parseSyndicationFeed(xml: string, sourceUrl: string): ParsedSyndicationFeed {
	const isAtom = /<feed\b/iu.test(xml);
	const itemPattern = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/giu : /<item\b[^>]*>([\s\S]*?)<\/item>/giu;
	const firstItemIndex = xml.search(isAtom ? /<entry\b/iu : /<item\b/iu);
	const header = firstItemIndex >= 0 ? xml.slice(0, firstItemIndex) : xml;
	const feedTitle = extractTag(header, ['title']) || new URL(sourceUrl).hostname;
	const items: NewsItem[] = [];
	for (const match of xml.matchAll(itemPattern)) {
		const block = match[1] ?? '';
		const url = safeArticleUrl(extractLink(block), sourceUrl);
		const title = extractTag(block, ['title']) || '未命名资讯';
		const date = extractTag(block, ['pubDate', 'published', 'updated']);
		items.push({
			title,
			url,
			summary: extractTag(block, ['description', 'summary', 'content']),
			publishedAt: timestamp(date),
			feedTitle,
			sourceUrl,
		});
	}
	items.sort((left, right) => right.publishedAt - left.publishedAt);
	return { feedTitle, items };
}

export class NewsService {
	private readonly cache = new Map<string, { loadedAt: number; feed: ParsedSyndicationFeed }>();

	constructor(
		private readonly request: NewsRequest,
		private readonly now: () => number = Date.now,
	) {}

	async load(feedUrls: readonly string[], refreshMinutes: number, force = false): Promise<NewsLoadResult> {
		const ttl = Math.max(1, refreshMinutes) * 60_000;
		const errors: NewsLoadResult['errors'] = [];
		const feeds = await Promise.all(feedUrls.map(async (url) => {
			try {
				const cached = this.cache.get(url);
				if (!force && cached && this.now() - cached.loadedAt < ttl) return cached.feed;
				const feed = parseSyndicationFeed(await this.request(url), url);
				this.cache.set(url, { loadedAt: this.now(), feed });
				return feed;
			} catch (error) {
				errors.push({ url, message: error instanceof Error ? error.message : String(error) });
				return null;
			}
		}));
		const items = feeds.flatMap((feed) => feed?.items ?? [])
			.sort((left, right) => right.publishedAt - left.publishedAt);
		return { items, errors };
	}
}
