const INTERNAL_TAG_ROOT = 'op-meta';
const TOKEN = /^#?op-meta\/(?:(v1)\/)?([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/u;

function encodeSegment(value: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/gu, '');
}

function decodeSegment(value: string): unknown {
	const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return JSON.parse(new TextDecoder().decode(bytes));
}

export function encodeTaskCustomMetadataTag(key: string, value: unknown): string {
	return `#${INTERNAL_TAG_ROOT}/v1/${encodeSegment(key)}/${encodeSegment(value)}`;
}

export function decodeTaskCustomMetadataTag(token: string): [string, unknown] | null {
	const match = token.match(TOKEN);
	if (!match) return null;
	try {
		const key = decodeSegment(match[2]!);
		if (typeof key !== 'string' || !key) return null;
		return [key, decodeSegment(match[3]!)];
	} catch { return null; }
}

export function isInternalTaskMetadataTag(value: string): boolean {
	const normalized = value.trim().replace(/^#+/u, '').toLocaleLowerCase();
	return normalized === INTERNAL_TAG_ROOT || normalized.startsWith(`${INTERNAL_TAG_ROOT}/`);
}
