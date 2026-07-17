import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function legacySegment(value: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

describe('custom task metadata codec', () => {
	it('round-trips Unicode values with an explicit v1 namespace', async () => {
		const moduleUrl = new URL('../../src/markdown/task-custom-metadata-codec.ts', import.meta.url);
		expect(existsSync(moduleUrl)).toBe(true);
		if (!existsSync(moduleUrl)) return;
		const codec = await import('../../src/markdown/task-custom-metadata-codec');
		const tag = codec.encodeTaskCustomMetadataTag('风险等级', ['紧急', 8, true]);
		expect(tag).toMatch(/^#op-meta\/v1\//u);
		expect(codec.decodeTaskCustomMetadataTag(tag)).toEqual(['风险等级', ['紧急', 8, true]]);
	});

	it('reads legacy tokens and rejects malformed or non-internal tags', async () => {
		const moduleUrl = new URL('../../src/markdown/task-custom-metadata-codec.ts', import.meta.url);
		if (!existsSync(moduleUrl)) return;
		const codec = await import('../../src/markdown/task-custom-metadata-codec');
		const legacy = `#op-meta/${legacySegment('severity')}/${legacySegment('critical')}`;
		expect(codec.decodeTaskCustomMetadataTag(legacy)).toEqual(['severity', 'critical']);
		expect(codec.decodeTaskCustomMetadataTag('#op-meta/v1/not-base64/bad')).toBeNull();
		expect(codec.decodeTaskCustomMetadataTag('#feature/mobile')).toBeNull();
		expect(codec.isInternalTaskMetadataTag('op-meta')).toBe(true);
		expect(codec.isInternalTaskMetadataTag('#op-meta/v1/key/value')).toBe(true);
		expect(codec.isInternalTaskMetadataTag('op-metadata')).toBe(false);
	});
});
