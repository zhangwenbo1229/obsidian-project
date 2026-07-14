import { describe, expect, it, vi } from 'vitest';
import { NewsService, parseSyndicationFeed, stripMarkup } from '../../src/views/dashboard-modules/news-service';

const rss = `<?xml version="1.0"?><rss><channel><title>示例资讯</title>
<item><title><![CDATA[<b>第二条</b>]]></title><link>https://example.com/2</link><description><![CDATA[摘要 <script>alert(1)</script>正文]]></description><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item>
<item><title>第一条</title><link>https://example.com/1</link><pubDate>Mon, 13 Jul 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

const atom = `<?xml version="1.0"?><feed><title>Atom 源</title>
<entry><title>Atom 条目</title><link href="https://example.org/a"/><summary>安全摘要</summary><updated>2026-07-15T08:00:00Z</updated></entry>
</feed>`;

describe('dashboard news service', () => {
	it('parses RSS and Atom as text-only content and sorts newest first', () => {
		const rssItems = parseSyndicationFeed(rss, 'https://example.com/rss');
		const atomItems = parseSyndicationFeed(atom, 'https://example.org/feed');
		expect(rssItems.feedTitle).toBe('示例资讯');
		expect(rssItems.items[0]).toMatchObject({ title: '第二条', url: 'https://example.com/2' });
		expect(rssItems.items[0]?.summary).toBe('摘要 alert(1) 正文');
		expect(atomItems.items[0]).toMatchObject({ title: 'Atom 条目', url: 'https://example.org/a' });
		expect(stripMarkup('<p>Hello&nbsp;<strong>world</strong></p>')).toBe('Hello world');
	});

	it('resolves relative article links and rejects non-http protocols', () => {
		const parsed = parseSyndicationFeed(`<?xml version="1.0"?><rss><channel><title>安全源</title>
			<item><title>相对链接</title><link>/article</link></item>
			<item><title>危险链接</title><link>javascript:alert(1)</link></item>
		</channel></rss>`, 'https://example.com/feed.xml');
		expect(parsed.items.find((item) => item.title === '相对链接')?.url).toBe('https://example.com/article');
		expect(parsed.items.find((item) => item.title === '危险链接')?.url).toBe('');
	});

	it('loads only configured feeds and caches each response', async () => {
		const request = vi.fn((url: string) => Promise.resolve(url.includes('atom') ? atom : rss));
		const service = new NewsService(request, () => 1_000);
		const first = await service.load(['https://example.com/rss', 'https://example.org/atom'], 30);
		const cached = await service.load(['https://example.com/rss', 'https://example.org/atom'], 30);
		expect(request).toHaveBeenCalledTimes(2);
		expect(first.items.map((item) => item.title)).toEqual(['Atom 条目', '第二条', '第一条']);
		expect(first.errors).toEqual([]);
		expect(cached.items).toEqual(first.items);
	});

	it('keeps successful feeds when one feed fails and supports manual refresh', async () => {
		const request = vi.fn((url: string) => url.includes('bad') ? Promise.reject(new Error('offline')) : Promise.resolve(rss));
		const service = new NewsService(request);
		const result = await service.load(['https://example.com/rss', 'https://bad.example/rss'], 30);
		expect(result.items).toHaveLength(2);
		expect(result.errors).toEqual([{ url: 'https://bad.example/rss', message: 'offline' }]);
		await service.load(['https://example.com/rss'], 30, true);
		expect(request).toHaveBeenCalledTimes(3);
	});
});
